import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, type OrderStatus } from "../src/modules/orders/order.repository.js";
import { assertTransition, canTransition } from "../src/modules/orders/order.state-machine.js";

describe("machine à états des commandes (unitaire)", () => {
  it("la cuisine suit le cycle RECEIVED → PREPARING → READY → PICKED_UP", () => {
    expect(canTransition("RECEIVED", "PREPARING", "STAFF")).toBe(true);
    expect(canTransition("PREPARING", "READY", "STAFF")).toBe(true);
    expect(canTransition("READY", "PICKED_UP", "ADMIN")).toBe(true);
  });

  it("on peut annuler depuis RECEIVED, PREPARING ou READY, jamais après", () => {
    for (const from of ["RECEIVED", "PREPARING", "READY"] as const) expect(canTransition(from, "CANCELLED", "STAFF")).toBe(true);
    expect(canTransition("PICKED_UP", "CANCELLED", "STAFF")).toBe(false);
    expect(canTransition("CANCELLED", "CANCELLED", "STAFF")).toBe(false);
  });

  it("PICKED_UP et CANCELLED sont des états finaux", () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransition("PICKED_UP", to as OrderStatus, "ADMIN")).toBe(false);
      expect(canTransition("CANCELLED", to as OrderStatus, "ADMIN")).toBe(false);
    }
  });

  it("sauter une étape ou rester sur place → 409 INVALID_TRANSITION", () => {
    expect(() => assertTransition("RECEIVED", "READY", "STAFF")).toThrow(expect.objectContaining({ status: 409, code: "INVALID_TRANSITION" }));
    expect(() => assertTransition("RECEIVED", "RECEIVED", "STAFF")).toThrow(expect.objectContaining({ status: 409 }));
  });

  it("un client ne peut qu'annuler (403 sinon), et seulement depuis RECEIVED (409 sinon)", () => {
    expect(() => assertTransition("RECEIVED", "PREPARING", "CUSTOMER")).toThrow(expect.objectContaining({ status: 403, code: "FORBIDDEN" }));
    expect(() => assertTransition("RECEIVED", "CANCELLED", "CUSTOMER")).not.toThrow();
    expect(() => assertTransition("PREPARING", "CANCELLED", "CUSTOMER")).toThrow(expect.objectContaining({ status: 409, code: "INVALID_TRANSITION" }));
  });
});