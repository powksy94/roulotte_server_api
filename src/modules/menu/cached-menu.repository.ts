import { EventBus } from "../../shared/event-bus.js";
import type { Pagination } from "../../shared/pagination.js";
import type { Allergen, Category, Dish, DishData, DishFilters, MenuRepository, OrderableDish } from "./menu.repository.js";

type Entry = { value: unknown; expiresAt: number };

export class CachedMenuRepository implements MenuRepository {
    private readonly entries = new Map<string, Entry>();
    private generation = 0;

    constructor(
        private readonly inner: MenuRepository,
        events: Pick<EventBus, "subscribe">,
        private readonly ttlMs = 60_000,
    ) {
        events.subscribe(() => this.clear());
    }

    clear() {
        this.generation++;
        this.entries.clear();
    }

    private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
        const hit = this.entries.get(key);
        if (hit && hit.expiresAt > Date.now()) return hit.value as T;
        const generation = this.generation;
        const value = await load();
        if (generation === this.generation) this.entries.set(key, {value, expiresAt: Date.now() + this.ttlMs });
        return value;
    }

    private async invalidating<T>(write: Promise<T>): Promise<T> {
        const result = await write;
        this.clear();
        return result;
    }

    // --- Lectures publiques de la carte : en cache ---
    listCategories() {
        return this.cached("categories", () => this.inner.listCategories());
    }

    listAllergens() {
        return this.cached("allergens", () => this.inner.listAllergens());
    }

    listDishes(filters: DishFilters, pagination: Pagination) {
        return this.cached(`dishes:${JSON.stringify([filters, pagination])}`, () => this.inner.listDishes(filters, pagination));
    }

    findDishById(id: number) {
        return this.cached(`dish:${id}`, () => this.inner.findDishById(id));
    }

    // --- Jamais en cache : prix et stock au moment de commander, vérifications de l'admin ---
    findDishesByIds(ids: number[]) {
        return this.inner.findDishesByIds(ids);
    }

    findDishByName(name: string) {
        return this.inner.findDishByName(name);
    }

    categoryExists(id: number) {
        return this.inner.categoryExists(id);
    }

    findExistingAllergenCodes(codes: string[]) {
        return this.inner.findExistingAllergenCodes(codes);
    }

    isDishOrdered(id: number) {
        return this.inner.isDishOrdered(id);
    }

    // --- Écritures : on vide le cache, la modification est visible immédiatement ---
    createDish(data: DishData) {
        return this.invalidating(this.inner.createDish(data));
    }

    updateDish(id: number, data: Partial<DishData>) {
        return this.invalidating(this.inner.updateDish(id, data));
    }

    deleteDish(id: number) {
        return this.invalidating(this.inner.deleteDish(id));
    }

    setDishImage(id: number, imageUrl: string) {
        return this.invalidating(this.inner.setDishImage(id, imageUrl));
    }
}