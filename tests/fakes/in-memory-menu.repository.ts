import type { Allergen, Category, Dish, DishFilters, MenuRepository } from "../../src/modules/menu/menu.repository.js";

// Faux repository : même contrat que la version Prisma, données passées par le test
export class InMemoryMenuRepository implements MenuRepository {
  constructor(
    private readonly categories: Category[] = [],
    private readonly allergens: Allergen[] = [],
    private readonly dishes: Dish[] = [],
  ) {}

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
}