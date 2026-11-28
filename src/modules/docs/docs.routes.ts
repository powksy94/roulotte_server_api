import { readFileSync } from "node:fs";
import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";

// Documentation interactive : le contrat fourni (copié tel quel dans docs/), servi par Swagger UI
export function createDocsRouter(contractPath = "docs/openapi.yaml") {
    const spec = parse(readFileSync(contractPath, "utf8")) as Record<string, unknown>;
    const router = Router();
    router.get("/docs/openapi.json", (_req, res) => {
        res.json(spec);
    });
    router.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));
    return router;
}
