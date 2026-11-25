import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./helpers/test-app.js";

describe("socle de l'application", () => {
  it("GET /health répond { status: 'ok' }", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("une route inconnue répond 404 NOT_FOUND au format du contrat", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/route-qui-n-existe-pas");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(typeof res.body.error.message).toBe("string");
  });
});

describe("authentification branchée", () => {
  const alice = { email: "alice@test.fr", name: "Alice", password: "MotDePasse1!" };

  it("inscription, connexion puis /auth/me", async () => {
    const { app } = buildTestApp();

    const register = await request(app).post("/auth/register").send(alice);
    expect(register.status).toBe(201);
    expect(register.body.role).toBe("CUSTOMER");
    expect(register.body).not.toHaveProperty("passwordHash");

    const login = await request(app).post("/auth/login").send({ email: alice.email, password: alice.password });
    expect(login.status).toBe(200);

    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(alice.email);
  });

  it("/auth/me sans jeton répond 401", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("on ne peut pas s'inscrire avec un rôle choisi (400)", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/auth/register").send({ ...alice, role: "ADMIN" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});