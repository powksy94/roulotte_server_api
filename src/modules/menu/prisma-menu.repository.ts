import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { type Pagination, toSkipTake } from "../../shared/pagination.js";
import type { Dish, DishData, DishFilters, MenuRepository } from "./menu.repository.js";

// Les champs d'un plat, sélectionnés une seule fois (DRY)
const dishSelect = {
    id: true,
    name: true,
    description: true,
    priceCents: true,
    available: true,
    stock: true,
    imageUrl: true,
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
            select: { id: true, name: true, priceCents: true, available: true, stock: true },
        });
    }

    // --- Palier 2 : administration ---
    createDish(data: DishData) {
        return this.prisma.dish.create({
            data: {
                name: data.name,
                description: data.description,
                priceCents: data.priceCents,
                available: data.available,
                stock: data.stock,
                category: { connect: { id: data.categoryId } },
                allergens: { connect: data.allergens.map((code) => ({ code})) },
            },
            select: dishSelect,
        });
    }

    // Mise à jour partielle : seuls les champs envoyés sont écrits
    updateDish(id: number, data: Partial<DishData>) {
        const update: Prisma.DishUpdateInput = {};
        if (data.name !== undefined) update.name = data.name;
        if (data.description !== undefined) update.description = data.description;
        if (data.priceCents !== undefined) update.priceCents = data.priceCents;
        if (data.available !== undefined) update.available = data.available;
        if (data.stock !== undefined) update.stock = data.stock;
        if (data.categoryId !== undefined) update.category = { connect: { id: data.categoryId } };
        // set : la liste d'allergènes est remplacée, pas complétée
        if (data.allergens !== undefined) update.allergens = { set: data.allergens.map((code) => ({ code })) };
        return this.prisma.dish.update({ where: { id }, data: update, select: dishSelect });
    }

    async deleteDish(id: number) {
        await this.prisma.dish.delete({ where: { id } });
    }

    findDishByName(name: string) {
        return this.prisma.dish.findUnique({ where: { name }, select: { id: true} })
    }

    async categoryExists(id: number) {
        return (await this.prisma.category.count({ where: { id } })) > 0;
    }

    async findExistingAllergenCodes(codes: string[]) {
        const found = await this.prisma.allergen.findMany({ where: { code: { in: codes } }, select: { code: true } });
        return found.map((a) => a.code);
    }

    async isDishOrdered(id: number) {
        return (await this.prisma.orderItem.count({ where: { dishId: id } })) > 0;
    }

    // --- Palier 3 : photo ---
    setDishImage(id: number, imageUrl: string) {
        return this.prisma.dish.update({ where: { id }, data: { imageUrl }, select: dishSelect })
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

