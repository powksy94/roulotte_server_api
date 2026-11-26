// src/modules/orders/order.service.ts
import { IOrderRepository } from './order-repository.js';
import { ListOrdersQuery, toOrderDto } from './order.dto.js';

export interface AuthUser {
  id: number;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
}

export class OrderService {
  constructor(private readonly orderRepo: IOrderRepository) {}

  async listOrders(user: AuthUser, query: ListOrdersQuery) {
    // Si CUSTOMER, on force le filtre sur son propre ID. Si STAFF/ADMIN, undefined = toutes les commandes.
    const customerId = user.role === 'CUSTOMER' ? user.id : undefined;

    const { items, total } = await this.orderRepo.findMany({
      ...query,
      customerId,
    });

    return {
      items: items.map(toOrderDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getOrderById(user: AuthUser, orderId: number) {
    const order = await this.orderRepo.findById(orderId);

    // 1. La commande n'existe pas -> 404
    if (!order) {
      throw Object.assign(new Error('Commande introuvable'), { status: 404, code: 'ORDER_NOT_FOUND' });
    }

    // 2. La commande appartient à un autre client et l'utilisateur n'est pas de la cuisine -> 404 (masquage)
    if (user.role === 'CUSTOMER' && order.customerId !== user.id) {
      throw Object.assign(new Error('Commande introuvable'), { status: 404, code: 'ORDER_NOT_FOUND' });
    }

    return toOrderDto(order);
  }
}