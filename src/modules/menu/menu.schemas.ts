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