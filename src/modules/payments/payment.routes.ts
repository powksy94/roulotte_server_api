import { Router } from "express";
import type { Auth } from "../../fourni/auth/index.js";
import type { PaymentController } from "./payment.controller.js";

export function createPaymentRouter(controller: PaymentController, auth: Auth) {
    const router = Router();
    // Cuisine et admin : 403 avant même de lire le corps ; la commande d'un autre client : 404 (service)
    router.post("/orders/:id/payment", auth.requireAuth, auth.requireRole("CUSTOMER"), controller.pay);
    return router;
}
