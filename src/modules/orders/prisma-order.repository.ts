import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { toSkipTake } from "../../shared/pagination.js";
import type { NewOrder, Order, OrderFilters, OrderRepository } from "./order.repository.js";

// Ce qu'on charge avec une commande, écrit une seule fois (DRY)
const orderInclude = {
  user: { select: { id: true, name: true } },
  items: { include: { dish: { select: { name: true } } }, orderBy: { dishId: "asc" } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

// Ligne Prisma → type du domaine : le reste de l'application ne voit jamais Prisma
const toOrder = (o: OrderRow): Order => ({
  id: o.id,
  status: o.status,
  note: o.note,
  totalCents: o.totalCents,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
  customer: { id: o.user.id, name: o.user.name },
  items: o.items.map((i) => ({
    dishId: i.dishId,
    name: i.dish.name,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents,
  })),
});

// Seul fichier du module orders qui parle à Prisma
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // Commande et lignes en une seule écriture : tout ou rien
  async create(data: NewOrder) {
    const row = await this.prisma.order.create({
      data: {
        userId: data.customerId,
        note: data.note,
        totalCents: data.totalCents,
        items: { create: data.items },
      },
      include: orderInclude,
    });
    return toOrder(row);
  }

  async findMany(filter: OrderFilters) {
    const where: Prisma.OrderWhereInput = {};
    // Dans le schéma Prisma, le client de la commande est userId
    if (filter.customerId !== undefined) where.userId = filter.customerId;
    if (filter.statuses) where.status = { in: filter.statuses };

    const direction: Prisma.SortOrder = filter.sort === "createdAt" ? "asc" : "desc";

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        // L'id départage deux commandes passées dans la même milliseconde
        orderBy: [{ createdAt: direction }, { id: direction }],
        ...toSkipTake(filter),
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items: rows.map(toOrder), total };
  }

  async findById(id: number) {
    const row = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    return row ? toOrder(row) : null;
  }
}
