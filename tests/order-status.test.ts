import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { Order, OrderRepository } from "../src/modules/orders/order.repository.js";
import { OrderService } from "../src/modules/orders/order.service.js";
import { buildTestApp, loginAs, noEvents } from "./helpers/test-app.js";

const commande = (status: Order["status"] = "RECEIVED"): Order => ({
  id: 1, status, note: null, totalCents: 0, createdAt: new Date(), updatedAt: new Date(),
  customer: { id: 1, name: "Alice" }, items: [],
});
const noDishes = { findDishesByIds: async () => [] };

describe("OrderService.updateStatus (unitaire)", () => {
  it("enregistre la transition en précisant le statut de départ", async () => {
    const updateStatus = vi.fn(async () => commande("PREPARING"));
    const service = new OrderService({ findById: async () => commande(), updateStatus } as unknown as OrderRepository, noDishes, noEvents);

    await expect(service.updateStatus({ id: 9, role: "STAFF" }, 1, "PREPARING")).resolves.toMatchObject({ status: "PREPARING" });
    expect(updateStatus).toHaveBeenCalledWith(1, "RECEIVED", "PREPARING");
  });

  it("si le statut a changé entre-temps (écriture refusée) → 409", async () => {
    const service = new OrderService(
      { findById: async () => commande(), updateStatus: async () => null } as unknown as OrderRepository,
      noDishes,
      noEvents,
    );
    await expect(service.updateStatus({ id: 9, role: "STAFF" }, 1, "CANCELLED")).rejects.toMatchObject({ status: 409, code: "INVALID_TRANSITION" });
  });

  it("n'écrit rien si la transition est interdite", async () => {
    const updateStatus = vi.fn();
    const service = new OrderService({ findById: async () => commande("PICKED_UP"), updateStatus } as unknown as OrderRepository, noDishes, noEvents);
    await expect(service.updateStatus({ id: 9, role: "STAFF" }, 1, "CANCELLED")).rejects.toMatchObject({ status: 409 });
    expect(updateStatus).not.toHaveBeenCalled();
  });
});

describe("PATCH /orders/:id/status (HTTP)", () => {
  it("la cuisine fait avancer une commande jusqu'au retrait", async () => {
    const { app, users, orders } = buildTestApp();
    const { token } = await loginAs(app, users, "STAFF");
    const order = await orders.seed({ customerId: 99, totalCents: 400 });

    for (const status of ["PREPARING", "READY", "PICKED_UP"]) {
      const res = await request(app).patch(`/orders/${order.id}/status`).set("Authorization", `Bearer ${token}`).send({ status });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
  });

  it("client : 403 pour avancer, 404 pour la commande d'un autre, 200 pour annuler la sienne", async () => {
    const { app, users, orders } = buildTestApp();
    const alice = await loginAs(app, users, "CUSTOMER");
    const bob = await loginAs(app, users, "CUSTOMER");
    const order = await orders.seed({ customerId: alice.user.id, totalCents: 400 });
    const patch = (token: string, status: string) =>
      request(app).patch(`/orders/${order.id}/status`).set("Authorization", `Bearer ${token}`).send({ status });

    expect((await patch(alice.token, "PREPARING")).body.error.code).toBe("FORBIDDEN");
    expect((await patch(bob.token, "CANCELLED")).body.error.code).toBe("NOT_FOUND");
    const cancelled = await patch(alice.token, "CANCELLED");
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("CANCELLED");
  });

  it("statut inconnu → 400, commande inexistante → 404", async () => {
    const { app, users, orders } = buildTestApp();
    const { token } = await loginAs(app, users, "STAFF");
    const order = await orders.seed({ customerId: 99, totalCents: 400 });

    const unknown = await request(app).patch(`/orders/${order.id}/status`).set("Authorization", `Bearer ${token}`).send({ status: "EN_COURS" });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe("VALIDATION_ERROR");
    const missing = await request(app).patch("/orders/999/status").set("Authorization", `Bearer ${token}`).send({ status: "PREPARING" });
    expect(missing.body.error.code).toBe("NOT_FOUND");
  });
});