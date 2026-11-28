import { Request, Response } from "express";
import { AppEventBus } from "../../shared/event-bus.js";
import { readonly } from "zod";

export class EventController {
    constructor (private readonly eventBus: AppEventBus) {}

    streamEvents = (req: Request, res: Response): void => {
        // 1. Récupération de l'utilisateur authentifié (injecté par votre middleware JWT)
        const user = req.user;
        if (!user) {
            res.status(401).end();
            return;
        }

        // 2. Configuration des en-têtes SSE
        res.setHeader("Content-type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        // Helper pour formater le message selon la norme SSE
        const sendsseEvent = (eventName: string, data: unknown) => {
            res.write(`event: ${eventName}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Un premier commentaire permet de confirmer immédiatement l'ouverture du flux
        res.write(": connected\n\n");

        const isKitchenOrAdmin = user.role === "STAFF" || user.role === "ADMIN"; // Adaptez la casse à vos enums

        // 3. Abonnement à order.created (cuisine et admin uniquement)
        const unsubscribeCreated = this.eventBus.on("order.created", (payload) => {
            if(isKitchenOrAdmin) {
                sendsseEvent("order.created", payload.order);
            }
        });

        // 4. Abonnement à order.updated (cuisine, admin, OU le client propriétaire)
        const unsubscribeUpdated = this.eventBus.on("order.updated", (payload) => {
            const isOrderOwner = user.id === payload.userId;

            if (isKitchenOrAdmin || isOrderOwner) {
                sendsseEvent("order.updated", payload.order);
            }
        });

        // 5. Maintien de la connexion ouverte (commentaire régulier toutes les 20s)
        const keepAliveTimer = setInterval(() => {
            res.write(": ping\n\n");
        }, 20000);

        // 6. Nettoyage strict quand le client ferme l'onglet ou coupe la requête
        req.on("close", () => {
            clearInterval(keepAliveTimer);
            unsubscribeCreated();
            unsubscribeUpdated();
            res.end();
        });
    };
}