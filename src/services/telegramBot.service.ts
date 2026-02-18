import TelegramBot from "node-telegram-bot-api";

import { config } from "../config";
import { UpdateParcelProperty } from "../models/ParcelUpdatedResponse.model";
import FetchServiceInstance from "./fetch.service";
import errorLogger from "./log.service";
import { ErrorLogType } from "../models/ErrorLogs.model";

class TelegramBotService {
  private bot;

  constructor() {
    this.bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, {
      polling: true,
    });
  }

  public async sendMessage(
    message: string,
    chatId: TelegramBot.ChatId = config.TELEGRAM_CHAT_ID
  ) {
    const MAX_LENGTH = 4096;
    try {
      for (let start = 0; start < message.length; start += MAX_LENGTH) {
        const chunk = message.substring(start, start + MAX_LENGTH);
        await this.bot.sendMessage(chatId, chunk, { parse_mode: "HTML" });
      }
    } catch (error) {
      errorLogger.log(`Error sending message to chat ${chatId}: ${error}`, ErrorLogType.ERROR);
    }
  }

  public async sendUpdateMessage(
    changes: UpdateParcelProperty[]
  ): Promise<void> {
    try {
      for await (const change of changes) {
        const formattedMessage = `<b>Status Update for Guide ${change.guideId
          } 📣 \n\n</b>Property <b>${change.property}</b> change from <b>${change.updatedFrom
          }</b> to <b>${change.updatedValue}</b>.\n\n<pre><code class="languague-JSON">${JSON.stringify(
            change,
            null,
            2
          )}</code></pre>`;
        await this.sendMessage(formattedMessage, config.TELEGRAM_CHAT_ID);
      }
    } catch (error) {
      errorLogger.log(`Error sending update message: ${error}`, ErrorLogType.ERROR);
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
      // Status
      this.bot.onText(/\/status/, async (message, match) => {
        const chatId = message.chat.id;

        const allParcerls = await FetchServiceInstance.sercargoFetchInTransitParcels();

        if (allParcerls.length <= 0) {
          this.sendMessage(`<b>No Packages Avialable</b>`, chatId);
        } else {
          let returningMessage = `<b>${allParcerls.length} Available Package${allParcerls.length > 1 ? 's' : ''}</b>\n\n`;
          let totalCharge = 0;

          for (const parcel of allParcerls) {
            returningMessage += `<b>${parcel.guia} - ${parcel.estado} - ${parcel.total}</b>\n`;
            totalCharge += parseFloat(parcel.total_monto);
          }

          returningMessage += `\n<b>Total Charge: ${totalCharge.toFixed(2)}</b>`;

          this.sendMessage(returningMessage, chatId);
        }
      });

      // Detailed
      this.bot.onText(/\/detailed/, async (message, match) => {
        const chatId = message.chat.id;

        const allParcerls = await FetchServiceInstance.sercargoFetchInTransitParcels();

        if (allParcerls.length <= 0) {
          this.sendMessage(`<b>No Packages Avialable</b>`, chatId);
        } else {
          let returningMessage = `<b>${allParcerls.length} Available Package${allParcerls.length > 1 ? 's' : ''}</b>\n\n`;

          for (const parcel of allParcerls) {
            returningMessage += `<b>${parcel.guia} - ${parcel.estado} - ${parcel.total}</b>\n<pre><code class="languague-JSON">${JSON.stringify(parcel, null, 2)}</code></pre>\n\n`;
          }

          this.sendMessage(returningMessage, chatId);
        }
      });

      // Errors
      this.bot.onText(/\/errors/, (message, match) => {
        const chatId = message.chat.id;

        const allLogs = errorLogger.getLogs();

        if (allLogs.length <= 0) {
          this.sendMessage(`<b>No Error Logs Avialable</b>`, chatId);
        } else {
          let returningMessage = `<b>${allLogs.length} Logs Found</b>\n\n`;

          returningMessage += `<pre><code class="language-JSON">${JSON.stringify(allLogs, null, 2)}</code></pre>`
          this.sendMessage(returningMessage, chatId)
        }
      });

    } catch (error) {
      errorLogger.log(`Error while listening for commands ${error}`, ErrorLogType.ERROR);
    }
  }
}

const telegramBotService = new TelegramBotService();

export default telegramBotService;
