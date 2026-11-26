import { notFound } from "../../shared/errors.js";
import type { IOrderRepository } from "./order-repository.js";
import { toOrderDto, type ListOrdersQuery } from "./order.dto.js";

export interface AuthUser {
  id: number;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
}

export class OrderService {
  constructor(private readonly orderRepo: IOrderRepository) {}

  async listOrders(user: AuthUser, query: ListOrdersQuery) {
    // Si CUSTOMER, on force le filtre sur son propre ID. Si STAFF/ADMIN, undefined = toutes les commandes.
    const customerId = user.role === "CUSTOMER" ? user.id : undefined;

    const { items, total } = await this.orderRepo.findMany({
      customerId,
      statuses: query.status,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
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

    // Inexistante, ou appartenant à un autre client (hors cuisine) : 404 dans les deux cas,
    // pour ne pas révéler qu'elle existe
    if (!order || (user.role === "CUSTOMER" && order.customer.id !== user.id)) {
      throw notFound("Commande introuvable");
    }

    return toOrderDto(order);
  }
}
