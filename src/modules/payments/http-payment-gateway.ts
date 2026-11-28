import { z } from "zod";
import { PaymentProviderError, type ChargeRequest, type ChargeResult, type PaymentGateway } from "./payment-gateway.js";

// On ne fait pas confiance à une API externe : sa réponse est validée avant usage
const chargeResponseSchema = z.object({
    id: z.string().min(1),
    status: z.enum(["succeeded", "declined"]),
    declineReason: z.string().optional(),
});

export type HttpPaymentGatewayOptions = { baseUrl: string; apiKey: string; timeoutMs: number };

// Adapter : traduit le port PaymentGateway (nos mots) vers l'API HTTP du prestataire (les siens).
// UN appel, sans nouvelle tentative : c'est le rôle de RetryingPaymentGateway
export class HttpPaymentGateway implements PaymentGateway {
    constructor(private readonly options: HttpPaymentGatewayOptions) {}

    async charge(request: ChargeRequest): Promise<ChargeResult> {
        const { status, body } = await this.post(request);

        // Panne du prestataire : passagère, on pourra réessayer
        if (status >= 500) throw new PaymentProviderError("error", `Prestataire en erreur (HTTP ${status})`);
        // 400, 401, 422 : notre requête ou notre clé est fausse ; réessayer ne changerait rien → 500
        if (status !== 201 && status !== 402) {
            throw new Error(`Appel au prestataire refusé (HTTP ${status}) : vérifier PAYMENT_API_KEY et le corps envoyé`);
        }

        const parsed = chargeResponseSchema.safeParse(body);
        if (!parsed.success) {
            throw new PaymentProviderError("error", "Réponse du prestataire au format inattendu", { cause: parsed.error });
        }
        const charge = parsed.data;
        if (status === 201 && charge.status === "succeeded") return { status: "succeeded", chargeId: charge.id };
        if (status === 402 && charge.status === "declined") {
            return { status: "declined", chargeId: charge.id, reason: charge.declineReason ?? "declined" };
        }
        throw new PaymentProviderError("error", `Réponse incohérente du prestataire (HTTP ${status}, ${charge.status})`);
    }

    private async post(request: ChargeRequest) {
        try {
            const res = await fetch(new URL("/v1/charges", this.options.baseUrl), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.options.apiKey}`,
                    "Idempotency-Key": request.idempotencyKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    amountCents: request.amountCents,
                    currency: "EUR",
                    reference: request.reference,
                    token: request.token,
                }),
                // Délai maximum d'UNE tentative : au-delà, fetch est interrompu
                signal: AbortSignal.timeout(this.options.timeoutMs),
            });
            const body: unknown = await res.json().catch(() => null);
            return { status: res.status, body };
        } catch (err) {
            if (err instanceof Error && err.name === "TimeoutError") {
                throw new PaymentProviderError("timeout", `Pas de réponse du prestataire en ${this.options.timeoutMs} ms`, { cause: err });
            }
            throw new PaymentProviderError("error", "Prestataire injoignable", { cause: err });
        }
    }
}
