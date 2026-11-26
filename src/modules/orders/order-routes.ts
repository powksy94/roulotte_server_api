import { Router } from "express";
import { Auth } from "../../fourni/auth/index.js";
import { OrderController } from "./order-controller.js";

export function createOrderRouter(controller: OrderController, auth: Auth) {
    const router = Router();

    // Toutes les routes /orders exigent un utilisateur connecté
    router.use(auth.requireAuth);

    router.get('/', controller.list);
    router.get('/:id', controller.getById);

    return router;
}