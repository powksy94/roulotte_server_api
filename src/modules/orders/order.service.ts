import type { AuthUser } from "../../fourni/auth/index.js";
import { dishUnavailable, invalidTransition, notFound, outOfStock, type UnavailableDish } from "../../shared/errors.js";
import { toPage } from "../../shared/pagination.js";
import type { MenuRepository } from "../menu/menu.repository.js";
import type { OrderRepository, OrderStatus } from "./order.repository.js";
import type { ListOrdersQuery, PlaceOrderInput } from "./order.schemas.js";
import { assertTransition } from "./order.state-machine.js";

// Aucun req/res ici, et aucun format de sortie : le service renvoie le domaine (Order)
export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    // ISP : le service n'a besoin que de cette méthode de la carte
    private readonly dishes: Pick<MenuRepository, "findDishesByIds">,
  ) {}

  async placeOrder(user: AuthUser, input: PlaceOrderInput) {
    const found = await this.dishes.findDishesByIds(input.items.map((i) => i.dishId));
    const dishById = new Map(found.map((d) => [d.id, d]));

    // On liste TOUS les plats refusés, pas seulement le premier
    const refused: UnavailableDish[] = [];
    const items: { dishId: number; quantity: number; unitPriceCents: number }[] = [];
    for (const { dishId, quantity } of input.items) {
      const dish = dishById.get(dishId);
      if (!dish) refused.push({ dishId, reason: "NOT_FOUND" });
      else if (!dish.available) refused.push({ dishId, reason: "UNAVAILABLE" });
      // Le prix vient de la base, jamais du client ; unitPriceCents fige le prix du jour
      else items.push({ dishId, quantity, unitPriceCents: dish.priceCents });
    }
    if (refused.length > 0) throw dishUnavailable(refused);

    const totalCents = items.reduce((sum, i) => sum + i.quantity * i.unitPriceCents, 0);

    const result = await this.orderRepo.create({ customerId: user.id, note: input.note ?? null, totalCents, items });
    if (!result.ok) throw outOfStock(result.insufficient);
    return result.order;
  }

  async listOrders(user: AuthUser, query: ListOrdersQuery) {
    // Si CUSTOMER, on force le filtre sur son propre ID. Si STAFF/ADMIN, undefined = toutes les commandes.
    const customerId = user.role === "CUSTOMER" ? user.id : undefined;
    const pagination = { page: query.page, pageSize: query.pageSize };

    const { items, total } = await this.orderRepo.findMany({
      customerId,
      statuses: query.status,
      sort: query.sort,
      ...pagination,
    });

    return toPage(items, total, pagination);
  }

  async getOrderById(user: AuthUser, orderId: number) {
    const order = await this.orderRepo.findById(orderId);

    // Inexistante, ou appartenant à un autre client (hors cuisine) : 404 dans les deux cas,
    // pour ne pas révéler qu'elle existe
    if (!order || (user.role === "CUSTOMER" && order.customer.id !== user.id)) {
      throw notFound("Commande introuvable");
    }

    return order;
  }

  async updateStatus(user: AuthUser, orderId: number, status: OrderStatus) {
    // 1. 404 si la commande n'existe pas ou n'est pas la sienne (client)
    const order = await this.getOrderById(user, orderId);
    // 2. 403 / 409 selon la machine à états
    assertTransition(order.status, status, user.role);
    // 3. Écriture conditionnelle : si le statut a changé entre-temps, la transition n'est plus valable
    const updated = await this.orderRepo.updateStatus(orderId, order.status, status);
    if (!updated) throw invalidTransition(order.status, status);
    return updated;
  }
}
