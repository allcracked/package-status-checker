declare namespace NodeJS {
  interface ProcessEnv {
    readonly TELEGRAM_BOT_TOKEN: string;
    readonly TELEGRAM_CHAT_ID: string;
    readonly TELEGRAM_POLLING_ENABLED?: string;
    readonly SERCARGO_API_TOKEN: string;
    readonly SERCARGO_DB_PATH?: string;
    readonly SERCARGO_USER_TOKEN?: string;
    readonly SERCARGO_USER_LOCKER?: string;
  }
}
