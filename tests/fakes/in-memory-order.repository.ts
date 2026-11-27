import type { MenuRepository } from "../../src/modules/menu/menu.repository.js";
import type {
  CreateOrderResult,
  NewOrder,
  Order,
  OrderFilters,
  OrderLine,
  OrderRepository,
  OrderStatus,
} from "../../src/modules/orders/order.repository.js";
import type { UserRepository } from "../../src/modules/users/user.repository.js";

// Faux repository des commandes : même interface que la version Prisma, sans base.
// Il ne gère pas le stock : le stock et la concurrence se testent sur la vraie base (recette)
export class InMemoryOrderRepository implements OrderRepository {
  private orders: Order[] = [];
  private nextId = 1;

  // Comme la base, il retrouve le nom du client et des plats
  constructor(
    private readonly users?: UserRepository,
    private readonly menu?: MenuRepository,
  ) {}

  async create(data: NewOrder): Promise<CreateOrderResult> {
    const user = await this.users?.findById(data.customerId);
    const dishes = (await this.menu?.findDishesByIds(data.items.map((i) => i.dishId))) ?? [];
    const order = await this.seed({
      customerId: data.customerId,
      customerName: user?.name,
      note: data.note,
      totalCents: data.totalCents,
      items: data.items.map((i) => ({ ...i, name: dishes.find((d) => d.id === i.dishId)?.name ?? "" })),
    });
    return { ok: true, order };
  }

  // Utilitaire de test : insère directement une commande, dans l'état voulu
  async seed(data: {
    customerId: number;
    customerName?: string;
    status?: OrderStatus;
    note?: string | null;
    totalCents: number;
    items?: OrderLine[];
  }) {
    const now = new Date();
    const order: Order = {
      id: this.nextId++,
      status: data.status ?? "RECEIVED",
      note: data.note ?? null,
      totalCents: data.totalCents,
      createdAt: now,
      updatedAt: now,
      customer: { id: data.customerId, name: data.customerName ?? "Client" },
      items: data.items ?? [],
    };
    this.orders.push(order);
    return order;
  }

  async findMany(filter: OrderFilters) {
    const matching = this.orders
      .filter((o) => filter.customerId === undefined || o.customer.id === filter.customerId)
      .filter((o) => !filter.statuses || filter.statuses.includes(o.status))
      // L'id croît avec la date de création : il sert de critère de tri
      .sort((a, b) => (filter.sort === "createdAt" ? a.id - b.id : b.id - a.id));

    const skip = (filter.page - 1) * filter.pageSize;
    return { items: matching.slice(skip, skip + filter.pageSize), total: matching.length };
  }

  async findById(id: number) {
    return this.orders.find((o) => o.id === id) ?? null;
  }

  // Même règle que la base : la mise à jour n'a lieu que si le statut vaut encore `from`
  async updateStatus(id: number, from: OrderStatus, to: OrderStatus) {
    const order = this.orders.find((o) => o.id === id);
    if (!order || order.status !== from) return null;
    order.status = to;
    order.updatedAt = new Date();
    return order;
  }
}