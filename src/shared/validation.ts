import { z } from "zod";
import { validationError } from "./errors.js";


// Valide body, query ou params ; renvoie les données typées ou lève 400 VALIDATION_ERROR
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
    const result = schema.safeParse(data);
    if (!result.success) {
        throw validationError(result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })))
    }
    return result.data;
}

// Paramètre :id commun à toutes les routes (entier strictement positif)
export const idParamsSchema = z.strictObject({
    id: z.coerce.number().int().positive(),
});