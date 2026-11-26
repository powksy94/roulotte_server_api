import { Router } from "express";
import type { Auth } from "../../fourni/auth/index.js";
import type { OrderController } from "./order-controller.js";

export function createOrderRouter(controller: OrderController, auth: Auth) {
    const router = Router();

    // Toutes les routes /orders exigent un utilisateur connecté
    // (à qui appartient la commande : vérifié dans le service)
    router.use(auth.requireAuth);

    router.post('/', controller.place);
    router.get('/', controller.list);
    router.get('/:id', controller.getById);

    return router;
}
