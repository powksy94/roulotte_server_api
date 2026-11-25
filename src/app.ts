import express from "express";
import type { Container } from "./container.js";
import { authErrorHandler, installSecurity } from "./fourni/auth/index.js";
import { errorHandler, notFoundHandler } from "./shared/error-handler.js";

export function createApp(container: Container) {
  const app = express();
  installSecurity(app, { corsOrigin: container.config.CORS_ORIGIN }); // AVANT les routes
  app.get("/health", (_req, res) => { 
    res.json({ status: "ok" }); 
  });
  app.use("/auth", container.auth.router);

  app.use(notFoundHandler);

  app.use(authErrorHandler);
  app.use(errorHandler);
  
  return app;
}