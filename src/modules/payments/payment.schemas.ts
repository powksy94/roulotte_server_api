import { z } from "zod";

// POST /orders/:id/payment : uniquement le jeton de carte ; un montant envoyé par le client → 400
export const paymentSchema = z.strictObject({
    token: z.string().trim().min(1),
});
