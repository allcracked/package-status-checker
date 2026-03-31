import "dotenv/config";
import z from "zod";

const validateEnv = () => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  if (!process.env.TELEGRAM_CHAT_ID) {
    throw new Error("TELEGRAM_CHAT_ID is required");
  }

  if (!process.env.SERCARGO_API_TOKEN) {
    throw new Error("SERCARGO_API_TOKEN is required");
  }
};

validateEnv();

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_CHAT_ID: z.string(),
  TELEGRAM_POLLING_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  SERCARGO_API_TOKEN: z.string(),
  SERCARGO_DB_PATH: z.string().optional(),
  SERCARGO_USER_TOKEN: z.string().optional(),
  SERCARGO_USER_LOCKER: z.string().transform(Number).optional(),
});

export const config = envSchema.parse(process.env);
