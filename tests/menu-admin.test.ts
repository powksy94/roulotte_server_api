import request from "supertest";
import { describe, expect, it } from "vitest";
import { MenuService } from "../src/modules/menu/menu.service.js";
import { InMemoryMenuRepository } from "./fakes/in-memory-menu.repository.js";
import { boissons, burgers, buildTestApp, loginAs, testDishes } from "./helpers/test-app.js";

const allergens = [{ id: 1, code: "lait", label: "Lait" }, { id: 2, code: "gluten", label: "Gluten" }];
const newService = () => new MenuService(new InMemoryMenuRepository([burgers, boissons], allergens, testDishes));
const valid = { name: "Tarte citron", priceCents: 450, categoryId: burgers.id };
const defaults = { description: "", available: true, stock: null, allergens: [] as string[] };

describe("MenuService : administration (unitaire)", () => {
  it("crée un plat avec les valeurs par défaut et les allergènes reliés (sans doublon)", async () => {
    const dish = await newService().createDish({ ...valid, ...defaults, allergens: ["gluten", "gluten", "lait"] });
    expect(dish).toMatchObject({ name: "Tarte citron", stock: null, category: { id: burgers.id } });
    expect(dish.allergens.map((a) => a.code).sort()).toEqual(["gluten", "lait"]);
  });

  it("refuse une catégorie ET un allergène inconnus en une seule erreur 422", async () => {
    const attempt = newService().createDish({ ...valid, ...defaults, categoryId: 999, allergens: ["lait", "kryptonite"] });
    await expect(attempt).rejects.toMatchObject({
      status: 422,
      code: "INVALID_REFERENCE",
      details: [{ field: "categoryId", value: 999 }, { field: "allergens", value: "kryptonite" }],
    });
  });

  it("un nom déjà pris → 409, mais un plat peut garder son propre nom", async () => {
    const service = newService();
    await expect(service.createDish({ ...valid, ...defaults, name: "Frites maison" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    await expect(service.updateDish(2, { name: "Frites maison", priceCents: 450 })).resolves.toMatchObject({ priceCents: 450 });
    await expect(service.updateDish(2, { name: "Le Classique" })).rejects.toMatchObject({ status: 409 });
  });

  it("un plat déjà commandé ne se supprime pas (409), un plat inexistant → 404", async () => {
    const repo = new InMemoryMenuRepository([burgers], allergens, testDishes);
    repo.orderedDishIds.add(1);
    const service = new MenuService(repo);
    await expect(service.deleteDish(1)).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    await expect(service.deleteDish(999)).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    await expect(service.deleteDish(2)).resolves.toBeUndefined();
  });
});

describe("Administration de la carte (HTTP)", () => {
  it("POST /dishes : 401 sans jeton, 403 pour un client et pour la cuisine", async () => {
    const { app, users } = buildTestApp();
    expect((await request(app).post("/dishes").send(valid)).status).toBe(401);
    for (const role of ["CUSTOMER", "STAFF"] as const) {
      const { token } = await loginAs(app, users, role);
      const res = await request(app).post("/dishes").set("Authorization", `Bearer ${token}`).send(valid);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }
  });

  it("POST /dishes : 201, Location, valeurs par défaut ; champ inconnu ou prix invalide → 400", async () => {
    const { app, users } = buildTestApp();
    const { token } = await loginAs(app, users, "ADMIN");
    const post = (body: object) => request(app).post("/dishes").set("Authorization", `Bearer ${token}`).send(body);

    const res = await post({ ...valid, allergens: ["gluten"] });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/dishes/${res.body.id}`);
    expect(res.body).toMatchObject({ description: "", available: true, stock: null, allergens: [{ code: "gluten" }] });

    expect((await post({ ...valid, name: "Autre", promo: true })).body.error.code).toBe("VALIDATION_ERROR");
    expect((await post({ ...valid, name: "Autre", priceCents: 10 })).status).toBe(400);
  });

  it("PATCH /dishes/:id : partiel, allergènes remplacés ; corps vide → 400, inexistant → 404", async () => {
    const { app, users } = buildTestApp();
    const { token } = await loginAs(app, users, "ADMIN");
    const patch = (id: number, body: object) =>
      request(app).patch(`/dishes/${id}`).set("Authorization", `Bearer ${token}`).send(body);

    const res = await patch(1, { priceCents: 650, allergens: ["lait"] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Le Classique", priceCents: 650, allergens: [{ code: "lait" }] });

    expect((await patch(1, {})).body.error.code).toBe("VALIDATION_ERROR");
    expect((await patch(1, { id: 5 })).status).toBe(400);
    expect((await patch(999, { priceCents: 600 })).body.error.code).toBe("NOT_FOUND");
  });

  it("DELETE /dishes/:id : 204 puis 404, et 409 pour un plat déjà commandé", async () => {
    const { app, users, menu } = buildTestApp();
    const { token } = await loginAs(app, users, "ADMIN");
    menu.orderedDishIds.add(1);

    expect((await request(app).delete("/dishes/2").set("Authorization", `Bearer ${token}`)).status).toBe(204);
    expect((await request(app).get("/dishes/2")).status).toBe(404);
    const ordered = await request(app).delete("/dishes/1").set("Authorization", `Bearer ${token}`);
    expect(ordered.status).toBe(409);
    expect(ordered.body.error.code).toBe("CONFLICT");
  });
});