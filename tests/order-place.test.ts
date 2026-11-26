import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { Order, OrderRepository } from "../src/modules/orders/order.repository.js";
import { OrderService } from "../src/modules/orders/order.service.js";
import { buildTestApp, loginAs } from "./helpers/test-app.js";

const client = { id: 1, role: "CUSTOMER" as const };
const plat = (id: number, priceCents: number, available = true) => ({ id, name: `Plat ${id}`, priceCents, available, stock: null });

const commande = (): Order => ({
  id: 1,
  status: "RECEIVED",
  note: null,
  totalCents: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: { id: 1, name: "Client" },
  items: [],
});

const fakeOrders = (overrides: Partial<OrderRepository>) => overrides as OrderRepository;

describe("OrderService.placeOrder (unitaire)", () => {
  it("prend les prix dans la base, pas chez le client, et calcule le total", async () => {
    const dishes = { findDishesByIds: async () => [plat(1, 1000), plat(2, 250)] };
    const create = vi.fn(async () => commande());
    const service = new OrderService(fakeOrders({ create }), dishes);

    await service.placeOrder(client, { items: [{ dishId: 1, quantity: 2 }, { dishId: 2, quantity: 1 }] });

    expect(create).toHaveBeenCalledWith({
      customerId: 1,
      note: null,
      totalCents: 2250,
      items: [
        { dishId: 1, quantity: 2, unitPriceCents: 1000 },
        { dishId: 2, quantity: 1, unitPriceCents: 250 },
      ],
    });
  });

  it("refuse les plats inexistants ET indisponibles en une seule erreur 422, sans rien créer", async () => {
    const dishes = { findDishesByIds: async () => [plat(1, 1000), plat(2, 500, false)] };
    const create = vi.fn();
    const service = new OrderService(fakeOrders({ create }), dishes);

    const attempt = service.placeOrder(client, {
      items: [{ dishId: 1, quantity: 1 }, { dishId: 2, quantity: 1 }, { dishId: 99, quantity: 1 }],
    });

    await expect(attempt).rejects.toMatchObject({
      status: 422,
      code: "DISH_UNAVAILABLE",
      details: [
        { dishId: 2, reason: "UNAVAILABLE" },
        { dishId: 99, reason: "NOT_FOUND" },
      ],
    });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("POST /orders (HTTP)", () => {
  it("sans jeton → 401", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/orders").send({ items: [{ dishId: 2, quantity: 1 }] });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("201, Location, prix et totaux calculés par le serveur", async () => {
    const { app, users } = buildTestApp();
    const { token, user } = await loginAs(app, users, "CUSTOMER");

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ dishId: 1, quantity: 2 }, { dishId: 2, quantity: 1 }], note: "Sans oignons" });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/orders/${res.body.id}`);
    expect(res.body).toMatchObject({
      status: "RECEIVED",
      note: "Sans oignons",
      totalCents: 2 * 1000 + 400,
      customer: { id: user.id, name: user.name },
    });
    expect(res.body.customer).not.toHaveProperty("email");
    expect(res.body.items).toContainEqual({
      dishId: 1,
      name: "Le Classique",
      quantity: 2,
      unitPriceCents: 1000,
      lineTotalCents: 2000,
    });
  });

  it("prix fourni par le client, plat en double, liste vide ou quantité > 10 → 400", async () => {
    const { app, users } = buildTestApp();
    const { token } = await loginAs(app, users, "CUSTOMER");
    const post = (body: object) => request(app).post("/orders").set("Authorization", `Bearer ${token}`).send(body);

    for (const body of [
      { items: [{ dishId: 2, quantity: 1, unitPriceCents: 1 }] },
      { items: [{ dishId: 2, quantity: 1 }, { dishId: 2, quantity: 2 }] },
      { items: [] },
      { items: [{ dishId: 2, quantity: 11 }] },
    ]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("plat indisponible ou inexistant → 422 DISH_UNAVAILABLE avec le détail", async () => {
    const { app, users } = buildTestApp();
    const { token } = await loginAs(app, users, "CUSTOMER");

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ dishId: 2, quantity: 1 }, { dishId: 3, quantity: 1 }, { dishId: 999, quantity: 1 }] });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("DISH_UNAVAILABLE");
    expect(res.body.error.details).toEqual([
      { dishId: 3, reason: "UNAVAILABLE" },
      { dishId: 999, reason: "NOT_FOUND" },
    ]);
  });
});
