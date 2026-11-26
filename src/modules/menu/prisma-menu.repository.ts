import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { Pagination, toSkipTake } from "../../shared/pagination.js";
import type { DishFilters, MenuRepository } from "./menu.repository.js";

// Les champs d'un plat, sélectionnés une seule fois (DRY)
const dishSelect = {
    id: true,
    name: true,
    description: true,
    priceCents: true,
    available: true,
    category: { select: { id: true, name :true }},
    allergens: { select: { code: true, label: true}, orderBy: { code: "asc"} },
} satisfies Prisma.DishSelect;

export class PrismaMenuRepository implements MenuRepository {
    constructor(private readonly prisma: PrismaClient) {}

    listCategories() {
        return this.prisma.category.findMany ({ orderBy: { position: "asc" } });
    }

    listAllergens() {
        return this.prisma.allergen.findMany({ orderBy: { code: "asc"} });
    }

    async listDishes(filters: DishFilters, pagination: Pagination) {
        const where = toDishWhere(filters);

        const [items, total] = await this.prisma.$transaction([
            this.prisma.dish.findMany({
                where,
                select: dishSelect,
                orderBy: [{ category: { position: "asc"} }, { name: "asc" }],
                ...toSkipTake(pagination),
            }),
            this.prisma.dish.count({ where }),
        ]);
        return { items, total };
    }

    findDishById(id: number) {
        return this.prisma.dish.findUnique({ where: { id }, select: dishSelect });
    }

    findDishesByIds(ids: number[]) {
        return this.prisma.dish.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, priceCents: true, available: true },
        });
    }
}

function toDishWhere(filters: DishFilters): Prisma.DishWhereInput {
    const where: Prisma.DishWhereInput = {};
    if (filters.categoryId !== undefined) where.categoryId = filters.categoryId;
    if (filters.available !== undefined) where.available = filters.available;
    // Relation n-n : aucun des allergènes du plat ne doit être dans la liste
    if (filters.allergenFree?.length) where.allergens =  { none: { code: { in: filters.allergenFree } } };
    // SQLite : LIKE est insensible à la casse (pour les lettres sans accent)
    if (filters.q) where.name = { contains: filters.q };
    return where;
}

