import { Router } from "express";
import type { Auth } from "../../fourni/auth/index.js";
import type { OrderController } from "./order.controller.js";

// Tout le routeur exige une connexion ; à qui appartient la commande : vérifié dans le service
export function createOrderRouter(controller: OrderController, auth: Auth) {
  const router = Router();
  router.use(auth.requireAuth);

  router.post("/", controller.place);
  router.get("/", controller.list);
  router.get("/:id", controller.getById);

  return router;
}
