import type { Role } from "../../fourni/auth/index.js";
import { forbidden, invalidTransition } from "../../shared/errors.js";
import type { OrderStatus } from "./order.repository.js";

// Les transitions autorisées, décrites à UN SEUL endroit (cuisine et admin)
export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  RECEIVED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: [],
  CANCELLED: [],
};

// Le client : uniquement annuler, et uniquement tant que la commande est RECEIVED
const CUSTOMER_TRANSITIONS: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  RECEIVED: ["CANCELLED"],
};

export function canTransition(from: OrderStatus, to: OrderStatus, role: Role): boolean {
  const allowed = role === "CUSTOMER" ? (CUSTOMER_TRANSITIONS[from] ?? []) : ALLOWED_TRANSITIONS[from];
  return allowed.includes(to);
}

// Lève l'erreur du contrat si le changement de statut est interdit.
// La propriété de la commande (404) est vérifiée avant, par le service.
export function assertTransition(from: OrderStatus, to: OrderStatus, role: Role): void {
  // Un client qui demande autre chose qu'une annulation : 403
  if (role === "CUSTOMER" && to !== "CANCELLED") {
    throw forbidden("Un client peut seulement annuler sa commande");
  }
  // Toute transition absente de la table : 409 (dont l'annulation par un client après RECEIVED)
  if (!canTransition(from, to, role)) {
    throw invalidTransition(from, to);
  }
}