export type OrderStatus =
  | "RECEIVED"
  | "PREPARING"
  | "READY"
  | "PICKED_UP"
  | "CANCELLED";

export type UserRole = "CUSTOMER" | "STAFF" | "ADMIN";

const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  RECEIVED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: [],
  CANCELLED: [],
};

export interface TransitionContext {
  currentStatus: OrderStatus;
  targetStatus: OrderStatus;
  actorRole: UserRole;
  isOwner: boolean;
}

export type TransitionResult =
  | { ok: true }

  | { ok: false; status: 403 | 404 | 409; code: string; message: string };

export function evaluateOrderTransition(
  ctx: TransitionContext
): TransitionResult {
  const { currentStatus, targetStatus, actorRole, isOwner } = ctx;

  if (actorRole === "CUSTOMER" && !isOwner) {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: "Commande introuvable",
    };
  }

  if (actorRole === "CUSTOMER" && targetStatus !== "CANCELLED") {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "Un client peut uniquement annuler sa commande",
    };
  }

  if (actorRole === "CUSTOMER" && currentStatus !== "RECEIVED") {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "La commande ne peut plus être annulée une fois en préparation",
    };
  }

  const allowedNext = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowedNext.includes(targetStatus)) {
    return {
      ok: false,
      status: 409,
      code: "INVALID_TRANSITION",
      message: `Transition interdite de ${currentStatus} vers ${targetStatus}`,
    };
  }

  return { ok: true };
}