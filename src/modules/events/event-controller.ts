import type { Request, Response } from "express";
import { currentUser } from "../../fourni/auth/index.js";
import type { DomainEvent, EventBus } from "../../shared/event-bus.js";
import { toOrderDto } from "../orders/order.dto.js";
import { canReceive } from "./event-filter.js";

const PING_INTERVAL_MS = 25_000;

export class EventController {
    constructor(private readonly eventBus: Pick<EventBus, "subscribe">) {}

    streamEvents = (req: Request, res: Response): void => {
        // 1. Utilisateur authentifié (requireAuth est passé avant)
        const user = currentUser(req);

        // 2. En-têtes SSE ; set conserve ceux déjà posés (CORS, X-Request-Id)
        res.status(200).set({
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        });
        res.flushHeaders();

        // Format SSE : event + data (DTO Order en JSON sur une ligne) + ligne vide
        const sendSseEvent = (event: DomainEvent) => {
            res.write(`event: ${event.type}\ndata: ${JSON.stringify(toOrderDto(event.order))}\n\n`);
        };

        // Un premier commentaire confirme immédiatement l'ouverture du flux
        res.write(": connected\n\n");

        // 3. Abonnement : chaque connexion ne reçoit que ce qu'elle a le droit de voir
        const unsubscribe = this.eventBus.subscribe((event) => {
            if (canReceive(user, event)) sendSseEvent(event);
        });

        // 4. Maintien de la connexion ouverte (commentaire régulier)
        const keepAliveTimer = setInterval(() => res.write(": ping\n\n"), PING_INTERVAL_MS);

        // 5. Nettoyage quand le client ferme l'onglet ou coupe le flux (sinon fuite mémoire)
        res.on("close", () => {
            clearInterval(keepAliveTimer);
            unsubscribe();
        });
    };
}
