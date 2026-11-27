import { Router } from "express";
import type { Auth } from "../../fourni/auth/index.js";
import type { EventBus } from "../../shared/event-bus.js";
import { HttpError } from "../../shared/errors.js";

// Flux SSE
export function createEventsRouter(_events: EventBus, auth: Auth) {
    const router = Router();
    router.get("/events", auth.requireAuth, () => {
        throw new HttpError(501, "NOT_IMPLEMENTED", "Flux SSE pas encore disponible");
    });
    return router;
}