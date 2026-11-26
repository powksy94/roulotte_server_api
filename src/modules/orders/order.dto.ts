import { z } from "zod";
import { paginationShape } from "../../shared/pagination.js";
import { ORDER_STATUSES, type Order } from "./order-repository.js";

// POST /orders : strictObject partout, un champ inconnu (unitPriceCents, totalCents…) → 400
const orderItemSchema = z.strictObject({
  dishId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(10),
});

export const placeOrderSchema = z.strictObject({
  items: z
    .array(orderItemSchema)
    .min(1)
    .max(20)
    .refine((items) => new Set(items.map((i) => i.dishId)).size === items.length, {
      message: "Un même plat ne peut apparaître qu'une fois",
    }),
  note: z.string().trim().max(200).optional(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

// GET /orders?status=RECEIVED,PREPARING&sort=createdAt&page=1&pageSize=20
export const listOrdersQuerySchema = z.strictObject({
  ...paginationShape,
  // Un ou plusieurs statuts séparés par des virgules ; un statut inconnu → 400
  status: z
    .string()
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(z.enum(ORDER_STATUSES)).min(1))
    .optional(),
  // -createdAt : plus récentes d'abord (défaut) ; createdAt : plus anciennes d'abord
  sort: z.enum(["createdAt", "-createdAt"]).default("-createdAt"),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

// Sortie au format du contrat : dates ISO, customer limité à { id, name }, totaux de ligne calculés
export function toOrderDto(order: Order) {
  return {
    id: order.id,
    status: order.status,
    note: order.note,
    totalCents: order.totalCents,
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
  };
}
