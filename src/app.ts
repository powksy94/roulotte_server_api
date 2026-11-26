import express from "express";
import type { Container } from "./container.js";
import { authErrorHandler, installSecurity } from "./fourni/auth/index.js";
import { errorHandler, notFoundHandler } from "./shared/error-handler.js";

export function createApp(container: Container) {
  const app = express();

  // 1. Sécurité et CORS EN PREMIER (avant toutes les routes)
  installSecurity(app, { corsOrigin: container.config.CORS_ORIGIN }); // AVANT les routes
  app.get("/health", (_req, res) => { 
    res.json({ status: "ok" }); 
  });

  // 2. Routes d'authentification fournies (débloque /register, /login et /me)
  app.use("/auth", container.auth.router);

  // 3. Vos autres routes (ex: /categories, /dishes, /orders...)
  // app.use('/orders', ...);

  app.use(notFoundHandler);

  // 4. Gestionnaire d'erreurs d'auth AVANT votre gestionnaire d'erreurs global
  app.use(authErrorHandler);
  app.use(errorHandler);
  
  return app;
}