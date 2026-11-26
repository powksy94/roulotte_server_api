import { Router } from "express";
import type { Auth } from "../../fourni/auth/index.js";
import type { MenuController } from "./menu.controller.js";

// La carte est publique : ni requireAuth ni requireRole (palier 2 : POST/PATCH/DELETE réservés à l'admin)
export function createMenuRouter(controller: MenuController, auth: Auth) {
    const router = Router();
    router.get("/categories", controller.listCategories);
    router.get("/allergens", controller.listAllergens);
    router.get("/dishes", controller.listDishes);
    router.get("/dishes/:id", controller.getDish);

    // Administration : connecté (401 sinon) ET admin (403 sinon), vérifié AVANT la validation du corps
    const adminOnly = [auth.requireAuth, auth.requireRole("ADMIN")];
    router.post("/dishes", ...adminOnly, controller.createDish);
    router.patch("/dishes/:id", ...adminOnly, controller.updateDish);
    router.delete("/dishes/:id", ...adminOnly, controller.deleteDish);

    return router;
}