import { randomUUID } from "node:crypto";
import express from "express";
import { pinoHttp } from "pino-http";
import { createMenuRouter } from "./modules/menu/menu.routes.js";
import { createOrderRouter } from "./modules/orders/order.routes.js";
import { createEventsRouter } from "./modules/events/events.routes.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import { createPaymentRouter } from "./modules/payments/payment.routes.js";
import { createDocsRouter } from "./modules/docs/docs.routes.js";
import type { Container } from "./container.js";
import { authErrorHandler, installSecurity } from "./fourni/auth/index.js";
import { errorHandler, notFoundHandler } from "./shared/error-handler.js";

export function createApp(container: Container) {
  const app = express();

  // 0. Identifiant de requête et logs, en tout premier : toute réponse, même une erreur, porte X-Request-Id
  app.use(
    pinoHttp({
      logger: container.logger,
      genReqId: (_req, res) => {
        const id = randomUUID();
        res.setHeader("X-Request-Id", id);
        return id;
      },
    }),
  );

  // 1. Sécurité et CORS EN PREMIER (avant toutes les routes)
  installSecurity(app, { corsOrigin: container.config.CORS_ORIGIN });

  // 2. Santé (vérifie la base) et photos publiques.
  app.use(createHealthRouter(container.health));
  // Option du palier 4 : documentation interactive du contrat sur /docs
  app.use(createDocsRouter());
  app.use(
    "/uploads",
    express.static(container.config.UPLOADS_DIR, {
      setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
    }),
  );

  // 3. Routes d'authentification fournies (débloque /register, /login et /me)
  app.use("/auth", container.auth.router);
  app.use(createMenuRouter(container.menuController, container.auth));

  // 3. Commandes : toutes les routes exigent une connexion
  app.use("/orders", createOrderRouter(container.orderController, container.auth));
  // Palier 4 : paiement (client de la commande uniquement)
  app.use(createPaymentRouter(container.paymentController, container.auth));
  app.use(createEventsRouter(container.events, container.auth));

  app.use(notFoundHandler);

  // 4. Gestionnaire d'erreurs d'auth AVANT votre gestionnaire d'erreurs global
  app.use(authErrorHandler);
  app.use(errorHandler);
  
  return app;
}