import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./helpers/test-app.js";

describe("la carte (HTTP)", () => {
  const { app } = buildTestApp();

  it("GET /categories : triées par position", async () => {
    const res = await request(app).get("/categories");
    expect(res.status).toBe(200);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual(["Burgers", "Boissons"]);
  });

  it("GET /dishes : pagination par défaut", async () => {
    const res = await request(app).get("/dishes");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 4 });
  });

  it("GET /dishes?available=false : uniquement les plats indisponibles", async () => {
    const res = await request(app).get("/dishes?available=false");
    expect(res.body.items.map((d: { name: string }) => d.name)).toEqual(["Le Burger du mois"]);
  });

  it("GET /dishes?pageSize=51 et ?page=0 → 400 VALIDATION_ERROR", async () => {
    expect((await request(app).get("/dishes?pageSize=51")).body.error.code).toBe("VALIDATION_ERROR");
    expect((await request(app).get("/dishes?page=0")).status).toBe(400);
  });

  it("GET /dishes/:id → 404 s'il n'existe pas, 400 si l'id est invalide", async () => {
    expect((await request(app).get("/dishes/999")).body.error.code).toBe("NOT_FOUND");
    expect((await request(app).get("/dishes/abc")).body.error.code).toBe("VALIDATION_ERROR");
  });
});