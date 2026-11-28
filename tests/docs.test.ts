import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./helpers/test-app.js";

describe("Documentation interactive (option)", () => {
  it("/docs/ sert Swagger UI", async () => {
    const { app } = buildTestApp();
    const page = await request(app).get("/docs/");
    expect(page.status).toBe(200);
    expect(page.text).toContain("swagger-ui");
  });

  it("/docs/openapi.json sert le contrat fourni, paiement compris", async () => {
    const { app } = buildTestApp();
    const spec = await request(app).get("/docs/openapi.json");
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toMatch(/^3\./);
    expect(spec.body.paths["/orders/{id}/payment"]).toBeDefined();
  });
});
