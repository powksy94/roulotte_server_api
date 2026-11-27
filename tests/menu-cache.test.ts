import { describe, expect, it, vi } from "vitest";
import { CachedMenuRepository } from "../src/modules/menu/cached-menu.repository.js";
import type { Order } from "../src/modules/orders/order.repository.js";
import { InMemoryEventBus } from "../src/shared/event-bus.js";
import { InMemoryMenuRepository } from "./fakes/in-memory-menu.repository.js";
import { boissons, burgers, testDishes } from "./helpers/test-app.js";

const page = { page: 1, pageSize: 10 };

function setup() {
  const inner = new InMemoryMenuRepository([burgers, boissons], [], testDishes);
  const events = new InMemoryEventBus();
  return { inner, events, cached: new CachedMenuRepository(inner, events) };
}

describe("CachedMenuRepository (Decorator)", () => {
  it("la deuxième lecture identique vient du cache", async () => {
    const { inner, cached } = setup();
    const listDishes = vi.spyOn(inner, "listDishes");

    await cached.listDishes({}, page);
    await cached.listDishes({}, page);
    await cached.listDishes({ available: true }, page); // autres filtres → autre entrée

    expect(listDishes).toHaveBeenCalledTimes(2);
  });

  it("une modification de l'admin est visible immédiatement", async () => {
    const { cached } = setup();
    expect((await cached.findDishById(1))?.priceCents).toBe(1000);

    await cached.updateDish(1, { priceCents: 990 });

    expect((await cached.findDishById(1))?.priceCents).toBe(990);
  });

  it("un événement de commande (stock modifié) vide le cache", async () => {
    const { inner, events, cached } = setup();
    const findDishById = vi.spyOn(inner, "findDishById");

    await cached.findDishById(1);
    events.publish({ type: "order.created", order: {} as Order });
    await cached.findDishById(1);

    expect(findDishById).toHaveBeenCalledTimes(2);
  });

  it("les prix et le stock lus pour commander ne sont jamais en cache", async () => {
    const { inner, cached } = setup();
    const findDishesByIds = vi.spyOn(inner, "findDishesByIds");

    await cached.findDishesByIds([1]);
    await cached.findDishesByIds([1]);

    expect(findDishesByIds).toHaveBeenCalledTimes(2);
  });
});