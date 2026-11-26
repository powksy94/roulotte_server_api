import { conflict, invalidReference, notFound } from "../../shared/errors.js";
import { toPage, type Pagination } from "../../shared/pagination.js";
import type { DishFilters, MenuRepository } from "./menu.repository.js";
import type { CreateDishInput, UpdateDishInput } from "./menu.schemas.js";

const unique = (codes: string[]) => [...new Set(codes)];

// Aucun req/res ici : le service ne connaît que le métier
export class MenuService {
    constructor(private readonly menu: MenuRepository) { }

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

    // --- Palier 2 : administration (route réservée à l'ADMIN par requireRole) ---

    async createDish(input: CreateDishInput) {
        await this.checkReferences(input.categoryId, input.allergens);
        await this.checkNameIsFree(input.name);
        return this.menu.createDish({ ...input, allergens: unique(input.allergens) });
    }

    async updateDish(id: number, input: UpdateDishInput) {
        await this.getDish(id);
        await this.checkReferences(input.categoryId, input.allergens);
        if (input.name !== undefined) await this.checkNameIsFree(input.name, id);
        return this.menu.updateDish(id, { ...input, allergens: input.allergens && unique(input.allergens) });
    }

    async deleteDish(id: number) {
        await this.getDish(id);
        if (await this.menu.isDishOrdered(id)) {
            throw conflict("Ce plat a déjà été commandé : rendez le indisponible plutôt que de le supprimer");
        }
        await this.menu.deleteDish(id);
    }

    private async checkReferences(categoryId?: number, allergens?: string[]) {
        const unknown: { field: string; value: string | number}[] = [];
        if (categoryId !== undefined && !(await this.menu.categoryExists(categoryId))) {
            unknown.push({ field: "categoryId", value: categoryId });
        }
        if (allergens?.length) {
            const codes = unique(allergens);
            const known = new Set(await this.menu.findExistingAllergenCodes(codes));
            for (const code of codes) if (!known.has(code)) unknown.push({ field: "allergens", value: code });
        }
        if (unknown.length > 0) throw invalidReference("Catégorie ou allergène inconnu", unknown);
    }

    private async checkNameIsFree(name: string, exceptId?: number) {
        const existing = await this.menu.findDishByName(name);
        if (existing && existing.id !== exceptId) throw conflict("Un plat porte déjà ce nom");
    }
}