import { z } from "zod";
import { paginationShape } from "../../shared/pagination.js";

// Query de GET /dishes : stricte, un paramètre inconnu → 400
export const dishQuerySchema = z.strictObject({
    ...paginationShape,
    category: z.coerce.number().int().positive().optional(),
    // Pas de z.coerce.boolean() : il transformerait "false" en true
    available: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
    allergenFree: z
        .string()
        .transform((s) => s.split(",").map((code) => code.trim()).filter(Boolean))
        .optional(),
    q: z.string().trim().min(1).max(50).optional(),
});

// Champs d'un plat
const dishFields = {
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(300),
    priceCents: z.number().int().min(50).max(10000),
    categoryId: z.number().int().positive(),
    allergens: z.array(z.string().trim().min(1)),
    available: z.boolean(),
    stock: z.number().int().min(0).nullable(),
};

// POST /dishes : name, priceCents et categoryId obligatoires
export const createDishSchema = z.strictObject({
    ...dishFields,
    description: dishFields.description.default(""),
    allergens: dishFields.allergens.default([]),
    available: dishFields.available.default(true),
    stock: dishFields.stock.default(null),
});

// PATCH /dishes/:id : tous les champs facultatifs
export const updateDishSchema = z
    .strictObject(dishFields)
    .partial()
    .refine((body) => Object.keys(body).length > 0, { message: "Au moins un champ à modifier" });

export type CreateDishInput = z.infer<typeof createDishSchema>;
export type UpdateDishInput = z.infer<typeof updateDishSchema>;