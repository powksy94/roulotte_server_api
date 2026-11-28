import type { Express } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { FakePaymentGateway } from "../src/modules/payments/fake-payment-gateway.js";
import { PaymentService } from "../src/modules/payments/payment.service.js";
import { InMemoryOrderRepository } from "./fakes/in-memory-order.repository.js";
import { buildTestApp, loginAs } from "./helpers/test-app.js";

const alice = { id: 1, role: "CUSTOMER" as const };

function setup() {
  const orders = new InMemoryOrderRepository();
  const gateway = new FakePaymentGateway();
  const events = { publish: vi.fn() };
  let n = 0;
  const service = new PaymentService(orders, gateway, events, () => `cle-${++n}`);
  return { orders, gateway, events, service };
}

describe("PaymentService (unitaire, faux prestataire)", () => {
  it("tok_visa : PAID, montant de la base, référence order-<id>, événement publié", async () => {
    const { orders, gateway, events, service } = setup();
    const order = await orders.seed({ customerId: 1, totalCents: 800 });

    const paid = await service.pay(alice, order.id, "tok_visa");

    expect(paid.paymentStatus).toBe("PAID");
    expect(gateway.calls).toEqual([{ amountCents: 800, reference: `order-${order.id}`, token: "tok_visa", idempotencyKey: "cle-1" }]);
    expect(events.publish).toHaveBeenCalledWith({ type: "order.updated", order: paid });
  });

  it("refus → 402, toujours UNPAID ; un nouveau paiement utilise une nouvelle clé", async () => {
    const { orders, gateway, events, service } = setup();
    const order = await orders.seed({ customerId: 1, totalCents: 800 });

    await expect(service.pay(alice, order.id, "tok_declined")).rejects.toMatchObject({ status: 402, code: "PAYMENT_DECLINED" });
    expect((await orders.findById(order.id))?.paymentStatus).toBe("UNPAID");
    expect(events.publish).not.toHaveBeenCalled();

    await service.pay(alice, order.id, "tok_visa");
    expect(gateway.calls.map((c) => c.idempotencyKey)).toEqual(["cle-1", "cle-2"]);
  });

  it("prestataire en panne → 502, trop lent → 504", async () => {
    const { orders, service } = setup();
    const order = await orders.seed({ customerId: 1, totalCents: 800 });
    await expect(service.pay(alice, order.id, "tok_down")).rejects.toMatchObject({ status: 502, code: "PAYMENT_PROVIDER_ERROR" });
    await expect(service.pay(alice, order.id, "tok_slow")).rejects.toMatchObject({ status: 504, code: "PAYMENT_PROVIDER_TIMEOUT" });
  });

  it("refusé d'avance, SANS appeler le prestataire : cuisine 403, autre client 404, payée 409, annulée 409", async () => {
    const { orders, gateway, service } = setup();
    const order = await orders.seed({ customerId: 1, totalCents: 800 });
    const paid = await orders.seed({ customerId: 1, totalCents: 800, paymentStatus: "PAID" });
    const cancelled = await orders.seed({ customerId: 1, totalCents: 800, status: "CANCELLED" });

    await expect(service.pay({ id: 9, role: "STAFF" }, order.id, "tok_visa")).rejects.toMatchObject({ status: 403 });
    await expect(service.pay({ id: 2, role: "CUSTOMER" }, order.id, "tok_visa")).rejects.toMatchObject({ status: 404 });
    await expect(service.pay(alice, 999, "tok_visa")).rejects.toMatchObject({ status: 404 });
    await expect(service.pay(alice, paid.id, "tok_visa")).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    await expect(service.pay(alice, cancelled.id, "tok_visa")).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    expect(gateway.calls).toEqual([]);
  });
});

describe("POST /orders/:id/payment (HTTP)", () => {
  async function unpaidOrder() {
    const { app, users } = buildTestApp();
    const customer = await loginAs(app, users, "CUSTOMER");
    const placed = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ items: [{ dishId: 2, quantity: 2 }] });
    return { app, users, token: customer.token, order: placed.body };
  }
  const pay = (app: Express, token: string, id: number, body: object) =>
    request(app).post(`/orders/${id}/payment`).set("Authorization", `Bearer ${token}`).send(body);

  it("une commande naît UNPAID ; tok_visa → 200 PAID, visible dans GET ; repayer → 409", async () => {
    const { app, token, order } = await unpaidOrder();
    expect(order.paymentStatus).toBe("UNPAID");

    const res = await pay(app, token, order.id, { token: "tok_visa" });
    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("PAID");
    const read = await request(app).get(`/orders/${order.id}`).set("Authorization", `Bearer ${token}`);
    expect(read.body.paymentStatus).toBe("PAID");
    expect((await pay(app, token, order.id, { token: "tok_visa" })).status).toBe(409);
  });

  it("tok_slow → 504 ; tok_flaky → 200 grâce à la nouvelle tentative", async () => {
    const { app, token, order } = await unpaidOrder();
    expect((await pay(app, token, order.id, { token: "tok_slow" })).body.error.code).toBe("PAYMENT_PROVIDER_TIMEOUT");
    expect((await pay(app, token, order.id, { token: "tok_flaky" })).status).toBe(200);
  });

  it("401 sans jeton, 403 pour la cuisine (avant la validation), 400 sans token ou avec un montant", async () => {
    const { app, users, token, order } = await unpaidOrder();
    const staff = await loginAs(app, users, "STAFF");

    expect((await request(app).post(`/orders/${order.id}/payment`).send({ token: "tok_visa" })).status).toBe(401);
    expect((await pay(app, staff.token, order.id, {})).status).toBe(403);
    expect((await pay(app, token, order.id, {})).body.error.code).toBe("VALIDATION_ERROR");
    expect((await pay(app, token, order.id, { token: "tok_visa", amountCents: 1 })).status).toBe(400);
  });
});
