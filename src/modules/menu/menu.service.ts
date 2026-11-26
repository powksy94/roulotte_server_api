import { notFound } from "../../shared/errors.js";
import { toPage, type Pagination } from "../../shared/pagination.js";
import type { DishFilters, MenuRepository } from "./menu.repository.js";

// Aucun req/res ici : le service ne connaît que le métier
export class MenuService {
    constructor(private readonly menu: MenuRepository) {}

    listCategories() {
        return this.menu.listCategories();
    }

    listAllergens() {
        return this.menu.listAllergens();
    }

    async listDishes(filters: DishFilters, pagination: Pagination) {
        const { items, total } = await this.menu.listDishes(filters, pagination);
        return toPage(items, total, pagination);
    }

    async getDish(id: number) {
        const dish = await this.menu.findDishById(id);
        if (!dish) throw notFound("Plat introuvable");
        return dish;
    }
}