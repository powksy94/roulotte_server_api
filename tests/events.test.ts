import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { canReceive } from "../src/modules/events/event-filter.js";
import type { Order, OrderRepository } from "../src/modules/orders/order.repository.js";
import { OrderService } from "../src/modules/orders/order.service.js";
import type { DomainEvent } from "../src/shared/event-bus.js";
import { buildTestApp, loginAs } from "./helpers/test-app.js";

const commande = (customerId: number, status: Order["status"] = "RECEIVED"): Order => ({
  id: 1, status, note: null, totalCents: 400, paymentStatus: "UNPAID", createdAt: new Date(), updatedAt: new Date(),
  customer: { id: customerId, name: "Alice" }, items: [],
});

describe("qui reçoit quoi (unitaire)", () => {
  const created: DomainEvent = { type: "order.created", order: commande(1) };
  const updated: DomainEvent = { type: "order.updated", order: commande(1, "PREPARING") };

  it("la cuisine et l'admin reçoivent tous les événements", () => {
    for (const role of ["STAFF", "ADMIN"] as const) {
      expect(canReceive({ id: 9, role }, created)).toBe(true);
      expect(canReceive({ id: 9, role }, updated)).toBe(true);
    }
  });

  it("un client reçoit order.updated de SA commande, jamais celles des autres ni order.created", () => {
    expect(canReceive({ id: 1, role: "CUSTOMER" }, updated)).toBe(true);
    expect(canReceive({ id: 2, role: "CUSTOMER" }, updated)).toBe(false);
    expect(canReceive({ id: 1, role: "CUSTOMER" }, created)).toBe(false);
  });
});

describe("OrderService publie sur le bus (unitaire)", () => {
  const dishes = { findDishesByIds: async () => [{ id: 1, name: "Frites", priceCents: 400, available: true, stock: null }] };
  const client = { id: 1, role: "CUSTOMER" as const };

  it("order.created une fois la commande enregistrée", async () => {
    const order = commande(1);
    const events = { publish: vi.fn() };
    const service = new OrderService({ create: async () => ({ ok: true as const, order }) } as unknown as OrderRepository, dishes, events);

    await service.placeOrder(client, { items: [{ dishId: 1, quantity: 1 }] });

    expect(events.publish).toHaveBeenCalledWith({ type: "order.created", order });
  });

  it("rien n'est publié si la commande est refusée", async () => {
    const events = { publish: vi.fn() };
    const create = async () => ({ ok: false as const, insufficient: [{ dishId: 1, available: 0 }] });
    const service = new OrderService({ create } as unknown as OrderRepository, dishes, events);

    await expect(service.placeOrder(client, { items: [{ dishId: 1, quantity: 1 }] })).rejects.toMatchObject({ status: 409 });
    expect(events.publish).not.toHaveBeenCalled();
  });

  it("order.updated après un changement de statut", async () => {
    const updated = commande(1, "PREPARING");
    const events = { publish: vi.fn() };
    const repo = { findById: async () => commande(1), updateStatus: async () => updated } as unknown as OrderRepository;
    const service = new OrderService(repo, dishes, events);

    await service.updateStatus({ id: 9, role: "STAFF" }, 1, "PREPARING");

    expect(events.publish).toHaveBeenCalledWith({ type: "order.updated", order: updated });
  });
});

// Ouvre le flux comme le front (fetch + Authorization) sur un vrai port, et lit le texte reçu
async function openStream(app: Express, token: string) {
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const controller = new AbortController();
  const res = await fetch(`http://127.0.0.1:${port}/events`, {
    headers: { authorization: `Bearer ${token}` },
    signal: controller.signal,
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  return {
    res,
    async readUntil(needle: string) {
      while (!text.includes(needle)) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      return text;
    },
    async close() {
      controller.abort();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

describe("GET /events (HTTP)", () => {
  it("sans jeton → 401", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/events");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("flux text/event-stream : la cuisine reçoit order.created au format Order", async () => {
    const { app, users } = buildTestApp();
    const staff = await loginAs(app, users, "STAFF");
    const customer = await loginAs(app, users, "CUSTOMER");
    const stream = await openStream(app, staff.token);
    try {
      expect(stream.res.status).toBe(200);
      expect(stream.res.headers.get("content-type")).toMatch(/^text\/event-stream/);

      const placed = await request(app)
        .post("/orders")
        .set("Authorization", `Bearer ${customer.token}`)
        .send({ items: [{ dishId: 2, quantity: 1 }] });

      const text = await stream.readUntil(`"id":${placed.body.id}`);
      expect(text).toContain("event: order.created");
      expect(text).toContain('"status":"RECEIVED"');
    } finally {
      await stream.close();
    }
  });
});
