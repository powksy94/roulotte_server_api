import { z } from 'zod';

// Validation des query params pour GET /orders
export const listOrdersQuerySchema = z.strictObject({
    status: z.enum(['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED']).optional(),
    sort: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
});


export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

// Validation du paramètre "id"
export const orderIdParamSchema = z.strictObject({
    id: z.coerce.number().int().positive(),
});

// Formatage de sortie (jamais d'entité Prisma brute)
export function toOrderDto(order: any) {
    return {
        id: order.id,
        customerId: order.customerId,
        status: order.status,
        totalCents: order.totalCents,
        createdAt: order.createdAt.toISOString(),
        items: order.items?.map((item: any) => ({
            dishId: item.dishId,
            dishName: item.dish?.name, // Selon notre Schéma Prisma
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            lineTotalCents: item.lineTotalCents,
        })) ?? [],
    };
}