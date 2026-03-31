import TelegramBot from "node-telegram-bot-api";

import { config } from "../config";
import db from "../database";
import { UpdateParcelProperty } from "../models/ParcelUpdatedResponse.model";
import { SercargoWrsParcelDetail } from "../models/SercargoWrs.model";
import InTransitParcel from "../models/InTransitParcels.model";
import { ErrorLogType } from "../models/ErrorLogs.model";
import FetchServiceInstance from "./fetch.service";
import errorLogger from "./log.service";

class TelegramBotService {
  private bot;

  constructor() {
    this.bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, {
      polling: config.TELEGRAM_POLLING_ENABLED,
    });
  }

  private splitMessage(message: string, maxLength: number): string[] {
    if (message.length <= maxLength) {
      return [message];
    }

    const chunks: string[] = [];
    let remaining = message;

    while (remaining.length > maxLength) {
      let splitIndex = remaining.lastIndexOf("\n", maxLength);
      if (splitIndex <= 0) {
        splitIndex = maxLength;
      }

      chunks.push(remaining.slice(0, splitIndex).trimEnd());
      remaining = remaining.slice(splitIndex).trimStart();
    }

    if (remaining.length > 0) {
      chunks.push(remaining);
    }

    return chunks;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private formatDateTime(unixTimestamp: number): string {
    return new Date(unixTimestamp * 1000).toLocaleString();
  }

  private parseAmount(amount: string): number {
    const parsedValue = Number.parseFloat(amount);
    return Number.isNaN(parsedValue) ? 0 : parsedValue;
  }

  private sortParcels(parcels: InTransitParcel[]): InTransitParcel[] {
    return [...parcels].sort((left, right) => {
      const leftDate = this.parseDate(left.probable);
      const rightDate = this.parseDate(right.probable);

      if (leftDate !== rightDate) {
        return leftDate - rightDate;
      }

      return left.guia.localeCompare(right.guia);
    });
  }

  private parseDate(dateValue: string): number {
    const parts = dateValue.split("/");
    if (parts.length !== 3) {
      return Number.MAX_SAFE_INTEGER;
    }

    const [day, month, year] = parts.map(Number);
    if (!day || !month || !year) {
      return Number.MAX_SAFE_INTEGER;
    }

    return new Date(year, month - 1, day).getTime();
  }

  private formatService(service: string): string {
    return service.replace(/\s+/g, " ").trim();
  }

  private formatPropertyName(property: string): string {
    switch (property) {
      case "estado":
        return "Status";
      case "total_monto":
        return "Total charge";
      default:
        return property;
    }
  }

  private formatParcelSummary(parcel: InTransitParcel): string {
    const etaText = parcel.probable
      ? `ETA <code>${this.escapeHtml(parcel.probable)}</code>`
      : "ETA <i>pending</i>";

    return [
      `• <b>${this.escapeHtml(parcel.guia)}</b>  <i>${this.escapeHtml(parcel.estado)}</i>`,
      `${this.escapeHtml(this.formatService(parcel.tipo))} • ${this.escapeHtml(parcel.peso)} lb • <code>${this.escapeHtml(parcel.total)}</code>`,
      etaText,
    ].join("\n");
  }

  private formatStatusMessage(parcels: InTransitParcel[]): string {
    const groupedParcels = this.sortParcels(parcels).reduce<Record<string, InTransitParcel[]>>(
      (acc, parcel) => {
        if (!acc[parcel.estado]) {
          acc[parcel.estado] = [];
        }

        acc[parcel.estado].push(parcel);
        return acc;
      },
      {}
    );

    const totalCharge = parcels.reduce(
      (sum, parcel) => sum + this.parseAmount(parcel.total_monto),
      0
    );

    const sections = Object.entries(groupedParcels).map(
      ([status, statusParcels]) =>
        [
          `<b>${this.escapeHtml(status)}</b> <code>${statusParcels.length}</code>`,
          ...statusParcels.map((parcel) => this.formatParcelSummary(parcel)),
        ].join("\n")
    );

    return [
      "<b>Package Status</b>",
      `<code>${parcels.length}</code> tracked • <code>L ${totalCharge.toFixed(
        2
      )}</code> total`,
      ...sections,
    ].join("\n\n");
  }

  private formatDetailedGuideList(parcels: InTransitParcel[]): string {
    return [
      "<b>Detailed Lookup</b>",
      "Use <code>/detailed GUIDE</code> to fetch one package.",
      "<b>Tracked guides</b>",
      ...this.sortParcels(parcels).map(
        (parcel) =>
          `• <b>${this.escapeHtml(parcel.guia)}</b>  <i>${this.escapeHtml(
            parcel.estado
          )}</i>`
      ),
    ].join("\n");
  }

  private formatDetailedParcel(detail: SercargoWrsParcelDetail): string {
    const lines = [
      `<b>Package ${this.escapeHtml(String(detail.numero))}</b>`,
      `<b>Status</b>: ${this.escapeHtml(detail.estado)}`,
      `<b>Tracking</b>: <code>${this.escapeHtml(detail.track_number)}</code>`,
      `<b>Package ID</b>: <code>${this.escapeHtml(String(detail.id))}</code>`,
      `<b>Service</b>: ${this.escapeHtml(this.formatService(detail.service))}`,
      `<b>Items</b>: <code>${this.escapeHtml(String(detail.total_items))}</code>`,
      `<b>Weight</b>: <code>${this.escapeHtml(detail.peso)} lb</code>`,
      `<b>Total</b>: <code>L ${this.escapeHtml(
        detail.total_lps_isv ?? detail.total_lps ?? "0"
      )}</code>`,
      `<b>Received</b>: <code>${this.escapeHtml(detail.fecha)}</code>`,
      `<b>Dispatch</b>: <code>${this.escapeHtml(
        detail.dispatch_date ?? "Pending"
      )}</code>`,
      `<b>Delivery</b>: <code>${this.escapeHtml(
        detail.delivery_date ?? "Pending"
      )}</code>`,
      `<b>Available</b>: <code>${this.escapeHtml(
        detail.available_date ?? "Pending"
      )}</code>`,
      `<b>Declared value</b>: <code>${this.escapeHtml(
        detail.valor_declarado ?? "N/A"
      )}</code>`,
      `<b>Invoice</b>: ${this.escapeHtml(detail.tiene_factura)}`,
      `<b>Notes</b>: ${this.escapeHtml(detail.customer_notes ?? "N/A")}`,
    ];

    if (detail.delivered_time) {
      lines.push(
        `<b>Delivered at</b>: <code>${this.escapeHtml(detail.delivered_time)}</code>`
      );
    }

    return lines.join("\n");
  }

  private formatHistoryMessage(
    guideId: string,
    changes: UpdateParcelProperty[]
  ): string {
    return [
      `<b>History for ${this.escapeHtml(guideId)}</b>`,
      ...changes.map(
        (change) =>
          `• <b>${this.escapeHtml(
            this.formatPropertyName(change.property)
          )}</b>: ${this.escapeHtml(change.updatedFrom)} → ${this.escapeHtml(
            change.updatedValue
          )}\n  <code>${this.escapeHtml(
            this.formatDateTime(change.updatedAt)
          )}</code>`
      ),
    ].join("\n");
  }

  private formatErrorMessage(
    logs: { time: string; type: string; message: string }[]
  ): string {
    return [
      "<b>Recent Logs</b>",
      ...logs.map(
        (log) =>
          `• <code>${this.escapeHtml(log.time)}</code> <b>${this.escapeHtml(
            log.type.toUpperCase()
          )}</b>\n${this.escapeHtml(log.message)}`
      ),
    ].join("\n\n");
  }

  private groupChangesByGuide(changes: UpdateParcelProperty[]) {
    return changes.reduce<Record<string, UpdateParcelProperty[]>>((acc, change) => {
      if (!acc[change.guideId]) {
        acc[change.guideId] = [];
      }

      acc[change.guideId].push(change);
      return acc;
    }, {});
  }

  private buildStatusActions(
    parcels: InTransitParcel[]
  ): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: this.sortParcels(parcels).map((parcel) => [
        {
          text: `/detailed ${parcel.guia}`,
          callback_data: `detailed:${parcel.guia}`,
        },
        {
          text: `/history ${parcel.guia}`,
          callback_data: `history:${parcel.guia}`,
        },
      ]),
    };
  }

  private async handleDetailedRequest(
    chatId: TelegramBot.ChatId,
    requestedGuide?: string
  ): Promise<void> {
    const parcelResult = await FetchServiceInstance.sercargoFetchInTransitParcels();

    if (!parcelResult.ok) {
      await this.sendMessage(
        `<b>Sercargo is unavailable right now.</b>\n${this.escapeHtml(
          parcelResult.error
        )}`,
        chatId,
        "HTML"
      );
      return;
    }

    if (parcelResult.data.length <= 0) {
      await this.sendMessage("<b>No tracked packages found</b>", chatId, "HTML");
      return;
    }

    if (!requestedGuide) {
      await this.sendMessage(
        this.formatDetailedGuideList(parcelResult.data),
        chatId,
        "HTML"
      );
      return;
    }

    const parcel = parcelResult.data.find((item) => item.guia === requestedGuide);

    if (!parcel) {
      await this.sendMessage(
        `<b>Guide ${this.escapeHtml(
          requestedGuide
        )} is not in the tracked package list.</b>`,
        chatId,
        "HTML"
      );
      return;
    }

    const detailResult = await FetchServiceInstance.sercargoFetchParcelDetails(
      Number.parseInt(parcel.rid, 10)
    );

    if (!detailResult.ok) {
      await this.sendMessage(
        `<b>Unable to fetch details for guide ${this.escapeHtml(
          requestedGuide
        )}.</b>\n${this.escapeHtml(detailResult.error)}`,
        chatId,
        "HTML"
      );
      return;
    }

    await this.sendMessage(
      this.formatDetailedParcel(detailResult.data),
      chatId,
      "HTML"
    );
  }

  private async handleHistoryRequest(
    chatId: TelegramBot.ChatId,
    requestedGuide?: string
  ): Promise<void> {
    if (!requestedGuide) {
      await this.sendMessage(
        "<b>History Lookup</b>\nUse <code>/history GUIDE</code>",
        chatId,
        "HTML"
      );
      return;
    }

    const changes = db.getParcelChanges(requestedGuide);

    if (!changes.length) {
      await this.sendMessage(
        `<b>No change history found for guide ${this.escapeHtml(
          requestedGuide
        )}.</b>`,
        chatId,
        "HTML"
      );
      return;
    }

    await this.sendMessage(
      this.formatHistoryMessage(
        requestedGuide,
        changes.map((change) => ({
          guideId: change.guia,
          property: change.changedKey,
          updatedValue: change.changedTo,
          updatedAt: change.changedAt,
          updatedFrom: change.changedValue,
        }))
      ),
      chatId,
      "HTML"
    );
  }

  public async sendMessage(
    message: string,
    chatId: TelegramBot.ChatId = config.TELEGRAM_CHAT_ID,
    parseMode?: TelegramBot.ParseMode,
    extraOptions?: Omit<TelegramBot.SendMessageOptions, "parse_mode">
  ) {
    const MAX_LENGTH = 4096;

    try {
      const chunks = this.splitMessage(message, MAX_LENGTH);

      for (const [index, chunk] of chunks.entries()) {
        const isLastChunk = index === chunks.length - 1;
        const options = {
          ...extraOptions,
          ...(parseMode ? { parse_mode: parseMode } : {}),
          ...(!isLastChunk ? { reply_markup: undefined } : {}),
        };

        await this.bot.sendMessage(chatId, chunk, options);
      }
    } catch (error) {
      errorLogger.log(
        `Error sending message to chat ${chatId}: ${error}`,
        ErrorLogType.ERROR
      );
    }
  }

  public async sendUpdateMessage(changes: UpdateParcelProperty[]): Promise<void> {
    try {
      const changesByGuide = this.groupChangesByGuide(changes);

      for (const [guideId, guideChanges] of Object.entries(changesByGuide)) {
        await this.sendMessage(
          [
            "<b>Package Update</b>",
            `<b>Guide</b>: <code>${this.escapeHtml(guideId)}</code>`,
            ...guideChanges.map(
              (change) =>
                `• <b>${this.escapeHtml(
                  this.formatPropertyName(change.property)
                )}</b>: ${this.escapeHtml(change.updatedFrom)} → ${this.escapeHtml(
                  change.updatedValue
                )}`
            ),
          ].join("\n"),
          config.TELEGRAM_CHAT_ID,
          "HTML"
        );
      }
    } catch (error) {
      errorLogger.log(
        `Error sending update message: ${error}`,
        ErrorLogType.ERROR
      );
    }
  }

  public async listenForMessages() {
    this.bot.on("message", (msg) => {
      const chatId = msg.chat.id;
      this.sendMessage("Received your message", chatId);
    });
  }

  public async listenForCommands() {
    try {
      this.bot.onText(/\/status/, async (message) => {
        const chatId = message.chat.id;
        const parcelResult = await FetchServiceInstance.sercargoFetchInTransitParcels();

        if (!parcelResult.ok) {
          await this.sendMessage(
            `<b>Sercargo is unavailable right now.</b>\n${this.escapeHtml(
              parcelResult.error
            )}`,
            chatId,
            "HTML"
          );
          return;
        }

        if (parcelResult.data.length <= 0) {
          await this.sendMessage("<b>No tracked packages found</b>", chatId, "HTML");
          return;
        }

        await this.sendMessage(
          this.formatStatusMessage(parcelResult.data),
          chatId,
          "HTML"
        );

        await this.sendMessage(
          "<b>Quick Actions</b>\nTap a button below to open details or history.",
          chatId,
          "HTML",
          {
            reply_markup: this.buildStatusActions(parcelResult.data),
          }
        );
      });

      this.bot.onText(/\/detailed(?:\s+(\d+))?/, async (message, match) => {
        await this.handleDetailedRequest(message.chat.id, match?.[1]);
      });

      this.bot.onText(/\/history(?:\s+(\d+))?/, async (message, match) => {
        await this.handleHistoryRequest(message.chat.id, match?.[1]);
      });

      this.bot.on("callback_query", async (query) => {
        const chatId = query.message?.chat.id;
        const callbackData = query.data;

        if (!chatId || !callbackData) {
          return;
        }

        const [action, guideId] = callbackData.split(":");

        if (action === "detailed") {
          await this.handleDetailedRequest(chatId, guideId);
          await this.bot.answerCallbackQuery(query.id, {
            text: `Opened details for ${guideId}`,
          });
          return;
        }

        if (action === "history") {
          await this.handleHistoryRequest(chatId, guideId);
          await this.bot.answerCallbackQuery(query.id, {
            text: `Opened history for ${guideId}`,
          });
        }
      });

      this.bot.onText(/\/errors/, async (message) => {
        const chatId = message.chat.id;
        const allLogs = errorLogger.getLogs().slice(-20).reverse();

        if (allLogs.length <= 0) {
          await this.sendMessage("<b>No error logs available</b>", chatId, "HTML");
          return;
        }

        await this.sendMessage(
          this.formatErrorMessage(allLogs),
          chatId,
          "HTML"
        );
      });
    } catch (error) {
      errorLogger.log(
        `Error while listening for commands ${error}`,
        ErrorLogType.ERROR
      );
    }
  }
}

const telegramBotService = new TelegramBotService();

export default telegramBotService;
