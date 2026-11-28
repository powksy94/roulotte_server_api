import express from "express";
import { createMenuRouter } from "./modules/menu/menu.routes.js";
import { createOrderRouter } from "./modules/orders/order.routes.js";
import type { Container } from "./container.js";
import { authErrorHandler, installSecurity } from "./fourni/auth/index.js";
import { errorHandler, notFoundHandler } from "./shared/error-handler.js";
import { AppEventBus } from "./shared/event-bus.js";
import { OrderService } from "./modules/orders/order.service.js";
import { EventController } from "./modules/events/event-controller.js";
import { InMemoryOrderRepository } from "../tests/fakes/in-memory-order.repository.js";
import { PrismaOrderRepository } from "./modules/orders/prisma-order.repository.js";

export function createApp(container: Container) {
  const app = express();

  // 1. Sécurité et CORS EN PREMIER (avant toutes les routes)
  installSecurity(app, { corsOrigin: container.config.CORS_ORIGIN }); // AVANT les routes
  app.get("/health", (_req, res) => { 
    res.json({ status: "ok" }); 
  });

  // 2. Routes d'authentification fournies (débloque /register, /login et /me)
  app.use("/auth", container.auth.router);
  app.use(createMenuRouter(container.menuController, container.auth));

  // 3. Commandes : toutes les routes exigent une connexion
  app.use("/orders", createOrderRouter(container.orderController, container.auth));

  app.use(notFoundHandler);

  // 4. Gestionnaire d'erreurs d'auth AVANT votre gestionnaire d'erreurs global
  app.use(authErrorHandler);
  app.use(errorHandler);

  //5. Instance unique (Singleton)
  const eventBus = new AppEventBus();

  // 6. Injection des dépendances
  const eventsController = new EventController(eventBus);

  //7. Route SSE protégée par authentification (en-tête Authorization)
  app.get("/events", eventsController.streamEvents);
  
  return app;
}