import "dotenv/config";
import { defineConfig, env } from "prisma/config";
import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("2h"),
  CORS_ORIGIN: z.url().default("http://localhost:5173"),
});

export type Config = z.infer<typeof configSchema>;

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Configuration invalide :\n" + z.prettifyError(parsed.error));
  process.exit(1);
}
export const config: Config = parsed.data;