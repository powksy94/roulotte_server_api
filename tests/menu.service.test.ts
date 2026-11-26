import { describe, expect, it, vi } from "vitest";
import type { MenuRepository } from "../src/modules/menu/menu.repository.js";
import { MenuService } from "../src/modules/menu/menu.service.js";
import { HttpError } from "../src/shared/errors.js";
import { dish } from "./helpers/test-app.js";

// Faux repository minimal : seules les méthodes utiles au test
const fakeRepo = (overrides: Partial<MenuRepository>) => overrides as MenuRepository;

describe("MenuService", () => {
  it("getDish lève 404 NOT_FOUND si le plat n'existe pas", async () => {
    const service = new MenuService(fakeRepo({ findDishById: async () => null }));
    await expect(service.getDish(42)).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    await expect(service.getDish(42)).rejects.toBeInstanceOf(HttpError);
  });

  it("listDishes renvoie le format { items, total, page, pageSize }", async () => {
    const listDishes = vi.fn(async () => ({ items: [dish(1, "Frites maison")], total: 12 }));
    const service = new MenuService(fakeRepo({ listDishes }));

    const page = await service.listDishes({ q: "frites" }, { page: 2, pageSize: 5 });

    expect(page).toEqual({ items: [expect.objectContaining({ id: 1 })], total: 12, page: 2, pageSize: 5 });
    expect(listDishes).toHaveBeenCalledWith({ q: "frites" }, { page: 2, pageSize: 5 });
  });
});