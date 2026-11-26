import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { toSkipTake } from "../../shared/pagination.js";

// Les statuts du contrat, écrits une seule fois (validation et, au palier 2, machine à états)
export const ORDER_STATUSES = ["RECEIVED", "PREPARING", "READY", "PICKED_UP", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderSort = "createdAt" | "-createdAt";

export type OrderLine = { dishId: number; name: string; quantity: number; unitPriceCents: number };

// Une commande telle que le reste de l'application la connaît (jamais une ligne Prisma brute)
export type Order = {
  id: number;
  status: OrderStatus;
  note: string | null;
  totalCents: number;
  createdAt: Date;
  updatedAt: Date;
  customer: { id: number; name: string };
  items: OrderLine[];
};

export type OrderFilters = {
  customerId?: number; // absent = toutes les commandes (cuisine, admin)
  statuses?: OrderStatus[];
  sort: OrderSort;
  page: number;
  pageSize: number;
};

export interface IOrderRepository {
  findMany(filter: OrderFilters): Promise<{ items: Order[]; total: number }>;
  findById(id: number): Promise<Order | null>;
}

// Ce qu'on charge avec une commande, écrit une seule fois (DRY)
const orderInclude = {
  user: { select: { id: true, name: true } },
  items: { include: { dish: { select: { name: true } } }, orderBy: { dishId: "asc" } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

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

export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

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
