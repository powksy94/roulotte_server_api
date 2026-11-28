import { randomUUID } from "node:crypto";
import type { AuthUser } from "../../fourni/auth/index.js";
import type { EventPublisher } from "../../shared/event-bus.js";
import {
    conflict,
    forbidden,
    notFound,
    paymentDeclined,
    paymentProviderError,
    paymentProviderTimeout,
} from "../../shared/errors.js";
import type { OrderRepository } from "../orders/order.repository.js";
import { PaymentProviderError, type PaymentGateway } from "./payment-gateway.js";

// Règles du paiement : qui paie, quand, et comment les réponses du prestataire deviennent des erreurs du contrat
export class PaymentService {
    constructor(
        private readonly orders: Pick<OrderRepository, "findById" | "markPaid">,
        private readonly gateway: PaymentGateway,
        private readonly events: EventPublisher,
        private readonly newIdempotencyKey: () => string = randomUUID,
    ) {}

    async pay(user: AuthUser, orderId: number, token: string) {
        // 1. Tout ce qui se vérifie sans le prestataire, AVANT de l'appeler
        if (user.role !== "CUSTOMER") throw forbidden("Seul le client de la commande peut la payer");
        const order = await this.orders.findById(orderId);
        if (!order || order.customer.id !== user.id) throw notFound("Commande introuvable");
        if (order.paymentStatus === "PAID") throw conflict("Commande déjà payée");
        if (order.status === "CANCELLED") throw conflict("Commande annulée : elle ne peut plus être payée");

        // 2. Une clé par paiement : toutes les tentatives de CE paiement la réutilisent (RetryingPaymentGateway),
        //    un nouveau paiement (autre carte après un refus) en a une nouvelle
        let result;
        try {
            result = await this.gateway.charge({
                amountCents: order.totalCents, // le montant vient de la base, jamais du client
                reference: `order-${order.id}`,
                token,
                idempotencyKey: this.newIdempotencyKey(),
            });
        } catch (error) {
            if (error instanceof PaymentProviderError) {
                throw error.failure === "timeout" ? paymentProviderTimeout() : paymentProviderError();
            }
            throw error;
        }
        if (result.status === "declined") throw paymentDeclined(result.reason);

        // 3. Écriture conditionnelle : un second paiement simultané ne repasse pas la commande en PAID
        const paid = await this.orders.markPaid(order.id, result.chargeId);
        if (!paid) throw conflict("La commande a été payée ou annulée pendant le paiement");

        // Observer : la cuisine voit la commande payée en direct
        this.events.publish({ type: "order.updated", order: paid });
        return paid;
    }
}
