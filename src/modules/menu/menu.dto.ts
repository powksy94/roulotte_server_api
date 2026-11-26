import type { Allergen, Category, Dish } from "./menu.repository.js";

// Sortie : uniquement les champs du contrat, construits explicitement
export const toCategoryDto = (c: Category) => ({
    id: c.id, 
    name: c.name, 
    position: c.position 
});

export const toAllergenDto = (a: Allergen) => ({
    id: a.id,
    code: a.code,
    label: a.label
});

export const toDishDto = (d: Dish) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    priceCents: d.priceCents,
    available: d.available,
    category: { id: d.category.id, name: d.category.name },
    allergens: d.allergens.map((a) => ({ code: a.code, label: a.label })),
});