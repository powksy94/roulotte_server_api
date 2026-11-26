// src/modules/orders/order.repository.ts
import { PrismaClient } from '../../generated/prisma/client.js';
import { ListOrdersQuery } from './order.dto.js';

export interface IOrderRepository {
  findMany(filter: { customerId?: number } & ListOrdersQuery): Promise<{ items: any[]; total: number }>;
  findById(id: number): Promise<any | null>;
}

export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findMany(filter: { customerId?: number } & ListOrdersQuery) {
    const where: any = {};
    if (filter.customerId !== undefined) where.customerId = filter.customerId;
    if (filter.status) where.status = filter.status;

    const skip = (filter.page - 1) * filter.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip,
        take: filter.pageSize,
        orderBy: { createdAt: filter.sort },
        include: { items: { include: { dish: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: number) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { dish: true } } },
    });
  }
}

export class InMemoryOrderRepository implements IOrderRepository {
  private orders: any[] = [];
  private nextId = 1;

  // Méthode utilitaire pour les tests (et future création de commande)
  async create(data: {
    customerId: number;
    status: string;
    totalCents: number;
    items?: any[];
  }) {
    const newOrder = {
      id: this.nextId++,
      customerId: data.customerId,
      status: data.status,
      totalCents: data.totalCents,
      createdAt: new Date(),
      items: data.items ?? [],
    };
    this.orders.push(newOrder);
    return newOrder;
  }

  async findMany(filter: { customerId?: number } & ListOrdersQuery) {
    let filtered = [...this.orders];

    if (filter.customerId !== undefined) {
      filtered = filtered.filter((o) => o.customerId === filter.customerId);
    }
    if (filter.status) {
      filtered = filtered.filter((o) => o.status === filter.status);
    }

    filtered.sort((a, b) => {
      const diff = a.createdAt.getTime() - b.createdAt.getTime();
      return filter.sort === 'asc' ? diff : -diff;
    });

    const total = filtered.length;
    const skip = (filter.page - 1) * filter.pageSize;
    const items = filtered.slice(skip, skip + filter.pageSize);

    return { items, total };
  }

  async findById(id: number) {
    return this.orders.find((o) => o.id === id) ?? null;
  }
}