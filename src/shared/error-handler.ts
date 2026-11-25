import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError, notFound } from "./errors.js";

export const notFoundHandler: RequestHandler = (req) => {
    throw notFound(`Route introuvable : ${req.method} ${req.path}`);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) {
        res.status(err.status).json({
            error: { code: err.code, message: err.message, ...(err.details === undefined ? {} : { details: err.details }) },
        });
        return;
    }
    console.error(err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Erreur interne du serveur" } });
};