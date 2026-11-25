// Module d'authentification FOURNI — ne pas modifier.
// Protections HTTP globales, à installer AVANT vos routes.
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";

export function installSecurity(app: Express, { corsOrigin, bodyLimit = "100kb" }: { corsOrigin: string | string[]; bodyLimit?: string }) {
  app.use(helmet()); // en-têtes de sécurité ; retire X-Powered-By
  app.use(cors({ origin: corsOrigin, exposedHeaders: ["Location", "X-Request-Id"] })); // le front, et lui seul
  app.use(express.json({ limit: bodyLimit })); // parseur JSON avec taille maximale
}
