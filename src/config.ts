import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("2h"),
  CORS_ORIGIN: z.url().default("http://localhost:5173"),
  // Palier 3 : niveau des logs (silent dans les tests) et dossier des photos
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  UPLOADS_DIR: z.string().min(1).default("uploads"),
  // Palier 4 : prestataire de paiement ; la clé n'a pas de valeur par défaut (jamais en dur dans le code)
  PAYMENT_URL: z.url().default("http://localhost:4010"),
  PAYMENT_API_KEY: z.string().min(1),
  PAYMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  PAYMENT_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(3),
  // Factory : http pour l'application, fake pour les tests (aucun appel réseau)
  PAYMENT_PROVIDER: z.enum(["http", "fake"]).default("http"),
  // Attente avant la 2e tentative, doublée à chaque fois (200 ms, 400 ms…)
  PAYMENT_RETRY_BASE_MS: z.coerce.number().int().min(0).default(200),
});

export type Config = z.infer<typeof configSchema>;

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Configuration invalide :\n" + z.prettifyError(parsed.error));
  process.exit(1);
}
export const config: Config = parsed.data;