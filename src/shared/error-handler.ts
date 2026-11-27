import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
// Types seulement : pino-http ajoute req.log aux requêtes (le middleware est installé dans app.ts)
import type {} from "pino-http";
import { HttpError, notFound, payloadTooLarge, validationError } from "./errors.js";

export const notFoundHandler: RequestHandler = (req) => {
    throw notFound(`Route introuvable : ${req.method} ${req.path}`);
};

// Les erreurs de multer (upload) traduites au format du contrat
function fromMulter(err: multer.MulterError): HttpError {
    if (err.code === "LIMIT_FILE_SIZE") return payloadTooLarge("Image trop volumineuse (2 Mo maximum)")
        return validationError([{ path: err.field ?? "image", message: err.message }]);
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    const error = err instanceof multer.MulterError ? fromMulter(err) : err;

    if (error instanceof HttpError) {
        res.status(error.status).json({
            error: { code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) },
        });
        return;
    }
    req.log.error({ err: error }, "Erreur imprevue");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Erreur interne du serveur" } });
};