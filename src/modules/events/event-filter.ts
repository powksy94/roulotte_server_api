import type { AuthUser } from "../../fourni/auth/index.js";
import type { DomainEvent } from "../../shared/event-bus.js";

// Cuisine et admin : tout. Client : uniquement order.updated de SES commandes
export function canReceive(user: AuthUser, event: DomainEvent): boolean {
    if (user.role === "STAFF" || user.role === "ADMIN") return true;
    return event.type === "order.updated" && event.order.customer.id === user.id;
}
