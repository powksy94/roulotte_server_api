import express from "express";
import { installSecurity } from "./fourni/auth/index.js";
import { config } from "./config.js";

export function createApp() {
  const app = express();
  installSecurity(app, { corsOrigin: config.CORS_ORIGIN }); // AVANT les routes
  app.get("/health", (_req, res) => { res.json({ status: "ok" }); });
  return app;
}