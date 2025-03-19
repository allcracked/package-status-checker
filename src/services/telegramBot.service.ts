import TelegramBot from "node-telegram-bot-api";

import { config } from "../config";

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
      await this.bot.sendMessage(chatId, message);
    } catch (error) {
      console.error(`Error sending message to chat ${chatId}: ${error}`);
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
