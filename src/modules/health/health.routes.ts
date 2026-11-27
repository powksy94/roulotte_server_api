import { Router } from "express";
import type { HealthRepository } from "./health.repository.js";

// KISS : pas de règle métier, la route interroge directement la base
export function createHealthRouter(health: HealthRepository) {
    const router = Router();
    router.get("/health", async (_req, res) => {
        if (await health.isDatabaseUp()) {
            res.json({ status: "ok", database: "up" });
        } else {
            res.status(503).json({ status: "degraded", database: "down" });
        }
    });
    return router;
}