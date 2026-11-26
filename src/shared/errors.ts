// Une erreur HTTP au format du contrat : { error: { code, message, details? } }
export class HttpError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
        public readonly details?: unknown,
    ) {
        super(message);
        this.name = "HttpError";
    }
}

// Les erreurs du contrat, écrites une seul fois (DRY)
export const validationError = (details: { path: string; message: string}[]) =>
    new HttpError(400, "VALIDATION_ERROR", "données invalides", details);

export const forbidden = (message = "Accès interdit") => new HttpError(403, "FORBIDDEN", message);

export const notFound = (message = "Ressource introuvable") => new HttpError(404, "NOT_FOUND", message);

export const conflict = (message: string) => new HttpError(409, "CONFLICT", message);

export type UnavailableDish = { dishId: number; reason: "NOT_FOUND" | "UNAVAILABLE" };

export const dishUnavailable = (details: UnavailableDish[]) =>
    new HttpError(422, "DISH_UNAVAILABLE", "Certains plats ne sont pas disponibles", details);

// Palier 2 : stock insuffisant ; available = portions restantes
export type InsufficientStock = { dishId: number; available: number };

export const outOfStock = (details: InsufficientStock[]) =>
    new HttpError(409, "OUT_OF_STOCK", "Stock insuffisant", details);

// Palier 2 : changement de statut interdit par la machine à états
export const invalidTransition = (from: string, to: string) =>
    new HttpError(409, "INVALID_TRANSITION", `Transition interdite : ${from} -> ${to}`);

// Palier 2 : catégorie ou code allergène inconnu
export const invalidReference = (message: string, details?: unknown) =>
    new HttpError(422, "INVALID_REFERENCE", message, details);