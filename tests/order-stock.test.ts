import { describe, expect, it, vi } from "vitest";
import type { Order, OrderRepository } from "../src/modules/orders/order.repository.js";
import { OrderService } from "../src/modules/orders/order.service.js";
import { noEvents } from "./helpers/test-app.js";

const client = { id: 1, role: "CUSTOMER" as const };
const plat = (id: number, stock: number | null) => ({ id, name: `Plat ${id}`, priceCents: 500, available: true, stock });
const dishes = { findDishesByIds: async () => [plat(1, 5), plat(2, 1)] };

const fakeOrders = (overrides: Partial<OrderRepository>) => overrides as OrderRepository;

describe("stock au passage de commande (unitaire)", () => {
  it("stock insuffisant → 409 OUT_OF_STOCK avec les portions restantes", async () => {
    const create = vi.fn(async () => ({ ok: false as const, insufficient: [{ dishId: 2, available: 1 }] }));
    const service = new OrderService(fakeOrders({ create }), dishes, noEvents);

    const attempt = service.placeOrder(client, { items: [{ dishId: 1, quantity: 2 }, { dishId: 2, quantity: 3 }] });

    await expect(attempt).rejects.toMatchObject({
      status: 409,
      code: "OUT_OF_STOCK",
      details: [{ dishId: 2, available: 1 }],
    });
  });

  it("le service transmet toutes les lignes au repository, qui gère le stock en une transaction", async () => {
    const order = { id: 7 } as Order;
    const create = vi.fn(async () => ({ ok: true as const, order }));
    const service = new OrderService(fakeOrders({ create }), dishes, noEvents);

    await expect(
      service.placeOrder(client, { items: [{ dishId: 1, quantity: 2 }, { dishId: 2, quantity: 1 }] }),
    ).resolves.toBe(order);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          { dishId: 1, quantity: 2, unitPriceCents: 500 },
          { dishId: 2, quantity: 1, unitPriceCents: 500 },
        ],
      }),
    );
  });
});