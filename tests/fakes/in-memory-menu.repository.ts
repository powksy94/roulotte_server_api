import type { Allergen, Category, Dish, DishData, DishFilters, MenuRepository } from "../../src/modules/menu/menu.repository.js";

// Faux repository : même contrat que la version Prisma, données passées par le test
export class InMemoryMenuRepository implements MenuRepository {
  private readonly categories: Category[];
  private readonly allergens: Allergen[];
  private dishes: Dish[];
  // Plats « déjà commandés » : le test les déclare lui-même
  readonly orderedDishIds = new Set<number>();

  constructor(categories: Category[] = [], allergens: Allergen[] = [], dishes: Dish[] = []) {
    // Copies : un test qui crée ou supprime un plat ne modifie pas les données des autres tests
    this.categories = [...categories];
    this.allergens = [...allergens];
    this.dishes = dishes.map((d) => ({ ...d }));
  }

  async listCategories() {
    return [...this.categories].sort((a, b) => a.position - b.position);
  }

  async listAllergens() {
    return [...this.allergens].sort((a, b) => a.code.localeCompare(b.code));
  }

  async listDishes(f: DishFilters, { page, pageSize }: { page: number; pageSize: number }) {
    const matching = this.dishes.filter(
      (d) =>
        (f.categoryId === undefined || d.category.id === f.categoryId) &&
        (f.available === undefined || d.available === f.available) &&
        (!f.allergenFree?.length || !d.allergens.some((a) => f.allergenFree!.includes(a.code))) &&
        (!f.q || d.name.toLowerCase().includes(f.q.toLowerCase())),
    );
    return { items: matching.slice((page - 1) * pageSize, page * pageSize), total: matching.length };
  }

  async findDishById(id: number) {
    return this.dishes.find((d) => d.id === id) ?? null;
  }

  async findDishesByIds(ids: number[]) {
    return this.dishes.filter((d) => ids.includes(d.id));
  }

  async createDish(data: DishData) {
    const dish = this.toDish(Math.max(0, ...this.dishes.map((d) => d.id)) + 1, data);
    this.dishes.push(dish);
    return dish;
  }

  async updateDish(id: number, data: Partial<DishData>) {
    const current = this.dishes.find((d) => d.id === id)!;
    const updated = this.toDish(id, {
      name: data.name ?? current.name,
      description: data.description ?? current.description,
      priceCents: data.priceCents ?? current.priceCents,
      available: data.available ?? current.available,
      stock: data.stock !== undefined ? data.stock : current.stock,
      categoryId: data.categoryId ?? current.category.id,
      allergens: data.allergens ?? current.allergens.map((a) => a.code),
    });
    this.dishes = this.dishes.map((d) => (d.id === id ? updated : d));
    return updated;
  }

  async deleteDish(id: number) {
    this.dishes = this.dishes.filter((d) => d.id !== id);
  }

  async findDishByName(name: string) {
    const dish = this.dishes.find((d) => d.name === name);
    return dish ? { id: dish.id } : null;
  }

  async categoryExists(id: number) {
    return this.categories.some((c) => c.id === id);
  }

  async findExistingAllergenCodes(codes: string[]) {
    return this.allergens.filter((a) => codes.includes(a.code)).map((a) => a.code);
  }

  async isDishOrdered(id: number) {
    return this.orderedDishIds.has(id);
  }

  // Comme la base : la catégorie et les allergènes sont résolus à partir de leurs identifiants
  private toDish(id: number, data: DishData): Dish {
    const category = this.categories.find((c) => c.id === data.categoryId)!;
    return {
      id,
      name: data.name,
      description: data.description,
      priceCents: data.priceCents,
      available: data.available,
      stock: data.stock,
      category: { id: category.id, name: category.name },
      allergens: this.allergens
        .filter((a) => data.allergens.includes(a.code))
        .map((a) => ({ code: a.code, label: a.label })),
    };
  }
}