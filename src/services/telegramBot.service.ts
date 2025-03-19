import TelegramBot from "node-telegram-bot-api";

import { config } from "../config";
import { UpdateParcelProperty } from "../models/ParcelUpdatedResponse.model";

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
    try {
      await this.bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    } catch (error) {
      console.error(`Error sending message to chat ${chatId}: ${error}`);
    }
  }

  public async sendUpdateMessage(
    changes: UpdateParcelProperty[]
  ): Promise<void> {
    try {
      for await (const change of changes) {
        const formattedMessage = `<b>Status Update for Guide ${
          change.guideId
        } 📣 \n\n</b>Property <b>${change.property}</b> change from <b>${
          change.updatedFrom
        }</b> to <b>${change.updatedValue}</b>.\n\n<pre><code class="languague-JSON">${JSON.stringify(
          change,
          null,
          2
        )}</code></pre>`;
        await this.sendMessage(formattedMessage, config.TELEGRAM_CHAT_ID);
      }
    } catch (error) {
      console.error(`Error sending update message: ${error}`);
    }
  }

  public async listenForMessages() {
    this.bot.on("message", (msg) => {
      const chatId = msg.chat.id;
      this.sendMessage("Received your message", chatId);

      console.log(`Received message from chat ${chatId}`);
    });
  }
}

const telegramBotService = new TelegramBotService();

export default telegramBotService;
