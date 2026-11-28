import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { InsufficientStock } from "../../shared/errors.js";
import { toSkipTake } from "../../shared/pagination.js";
import type { CreateOrderResult, NewOrder, Order, OrderFilters, OrderRepository, OrderStatus } from "./order.repository.js";

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
  paymentStatus: o.paymentStatus,
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

// Lever cette erreur DANS la transaction l'annule : aucun stock n'est consommé
class InsufficientStockError extends Error {
  constructor(readonly insufficient: InsufficientStock[]) {
    super("Stock insuffisant");
  }
}

// Seul fichier du module orders qui parle à Prisma
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) { }

  // Commande et lignes en une seule écriture : tout ou rien
  async create(data: NewOrder): Promise<CreateOrderResult> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const insufficient: InsufficientStock[] = [];

        for (const { dishId, quantity } of data.items) {
          const { count } = await tx.dish.updateMany({
            where: { id: dishId, OR: [{ stock: null }, { stock: { gte: quantity } }] },
            data: { stock: { decrement: quantity } },
          });
          if (count === 0) {
            const dish = await tx.dish.findUnique({ where: { id: dishId }, select: { stock: true } });
            insufficient.push({ dishId, available: dish?.stock ?? 0 });
          }
        }

        // Toutes les lignes ont été examinées : on annule tout si l'une d'elles manque de stock
        if (insufficient.length > 0) throw new InsufficientStockError(insufficient);

        return tx.order.create({
          data: {
            userId: data.customerId,
            note: data.note,
            totalCents: data.totalCents,
            items: { create: data.items },
          },
          include: orderInclude,
        });
      });
      return { ok: true, order: toOrder(row) };
    } catch (error) {
      if (error instanceof InsufficientStockError) return { ok: false, insufficient: error.insufficient };
      throw error;
    }
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

  async updateStatus(id: number, from: OrderStatus, to: OrderStatus) {
    return this.prisma.$transaction(async (tx) => {

      const { count } = await tx.order.updateMany({ where: { id, status: from }, data: { status: to } });
      if (count === 0) return null;

      if (to === "CANCELLED") {
        const items = await tx.orderItem.findMany({ where: { orderId: id }, select: { dishId: true, quantity: true } });
        for (const { dishId, quantity } of items) {
          await tx.dish.updateMany({
            where: { id: dishId, stock: { not: null } },
            data: { stock: { increment: quantity } },
          });
        }
      }

      const row = await tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
      return toOrder(row);
    });
  }

  // Palier 4 : même verrou optimiste que pour le statut ; deux paiements simultanés → un seul passe
  async markPaid(id: number, chargeId: string) {
    const { count } = await this.prisma.order.updateMany({
      where: { id, paymentStatus: "UNPAID", status: { not: "CANCELLED" } },
      data: { paymentStatus: "PAID", chargeId },
    });
    return count === 0 ? null : this.findById(id);
  }
}
