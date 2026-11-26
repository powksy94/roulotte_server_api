export type Category = { id: number; name: string; position: number };

export type Allergen = { id: number; code: string; label: string };

export type Dish = {
    id: number;
    name: string;
    description: string;
    priceCents: number;
    available: boolean;
    stock: number | null;
    category: { id: number; name: string };
    allergens: {code: string; label: string}[];
};

export type DishFilters = {
    categoryId?: number;
    available?: boolean;
    allergenFree?: string[];
    q?: string;
};

export type OrderableDish = { id: number; name: string; priceCents: number;  available: boolean; stock: number | null };

// Ce que le service demande d'enregistrer pour un plat
export type DishData = {
    name: string,
    description: string,
    priceCents: number,
    categoryId: number;
    allergens: string[];
    available: boolean;
    stock: number | null;
};

export interface MenuRepository {
    listCategories(): Promise<Category[]>;
    listAllergens(): Promise<Allergen[]>;
    listDishes(filters: DishFilters, pagination: { page: number; pageSize: number}): Promise<{ items: Dish[]; total: number }>;
    findDishById(id: number): Promise<Dish | null>;
    findDishesByIds(id: number[]): Promise<OrderableDish[]>;

    // Palier 2 : administration
    createDish(data: DishData): Promise<Dish>;
    updateDish(id: number, data: Partial<DishData>): Promise<Dish>;
    deleteDish(id: number): Promise<void>;
    findDishByName(name: string): Promise<{ id: number } | null>;
    categoryExists(id: number): Promise<boolean>;
    findExistingAllergenCodes(codes: string[]): Promise<string[]>;
    isDishOrdered(id: number): Promise<boolean>;
}