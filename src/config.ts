import "dotenv/config";
import z from "zod";

const validateEnv = () => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  if (!process.env.TELEGRAM_CHAT_ID) {
    throw new Error("TELEGRAM_CHAT_ID is required");
  }

  if (!process.env.SERCARGO_USER_TOKEN) {
    throw new Error("SERCARGO_USER_TOKEN is required");
  }

  if (!process.env.SERCARGO_USER_LOCKER) {
    throw new Error("SERCARGO_USER_LOCKER is required");
  }
};

validateEnv();

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_CHAT_ID: z.string(),
  SERCARGO_USER_TOKEN: z.string(),
  SERCARGO_USER_LOCKER: z.string().transform(Number),
});

export const config = envSchema.parse(process.env);
