// Module d'authentification FOURNI — ne pas modifier.
// Erreurs du module, au format du contrat : { error: { code, message, details? } }
import type { ErrorRequestHandler } from "express";

export class AuthHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AuthHttpError";
  }
}

// À placer AVANT votre propre middleware d'erreurs : traite les erreurs du module
// et celles du parseur JSON (corps illisible ou trop gros), passe les autres.
export const authErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  const send = (status: number, code: string, message: string, details?: unknown) =>
    res.status(status).json({ error: { code, message, ...(details === undefined ? {} : { details }) } });

  if (err instanceof AuthHttpError) return send(err.status, err.code, err.message, err.details);
  if (err?.type === "entity.parse.failed") return send(400, "INVALID_JSON", "Corps JSON invalide");
  if (err?.type === "entity.too.large") return send(413, "PAYLOAD_TOO_LARGE", "Corps de requête trop volumineux");
  return next(err);
};
