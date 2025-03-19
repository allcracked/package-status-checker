declare namespace NodeJS {
  interface ProcessEnv {
    readonly TELEGRAM_BOT_TOKEN: string;
    readonly TELEGRAM_CHAT_ID: string;
    readonly SERCARGO_USER_TOKEN: string;
    readonly SERCARGO_USER_LOCKER: string;
  }
}
