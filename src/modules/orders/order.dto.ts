import type { Order } from "./order.repository.js";

// Sortie au format du contrat : dates ISO, customer limité à { id, name }, totaux de ligne calculés
export const toOrderDto = (order: Order) => ({
  id: order.id,
  status: order.status,
  note: order.note,
  totalCents: order.totalCents,
  paymentStatus: order.paymentStatus,
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
  customer: { id: order.customer.id, name: order.customer.name },
  items: order.items.map((item) => ({
    dishId: item.dishId,
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    lineTotalCents: item.quantity * item.unitPriceCents,
  })),
});
