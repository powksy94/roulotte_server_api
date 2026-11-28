import { Router } from "express";
import type { Auth } from "../../fourni/auth/index.js";
import type { EventBus } from "../../shared/event-bus.js";
import { EventController } from "./event-controller.js";

// Flux SSE authentifié par l'en-tête Authorization (le front lit avec fetch)
export function createEventsRouter(events: Pick<EventBus, "subscribe">, auth: Auth) {
    const router = Router();
    const controller = new EventController(events);
    router.get("/events", auth.requireAuth, controller.streamEvents);
    return router;
}
