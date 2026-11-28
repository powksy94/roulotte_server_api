// Port du paiement : ce dont le service a besoin, dans SES mots (pas ceux du prestataire).
// L'Adapter HTTP (partie A) traduit vers l'API du simulateur ; les tests utilisent un faux.

export type ChargeRequest = {
    amountCents: number;
    reference: string; // order-<id>
    token: string; // tok_visa, tok_declined…
    idempotencyKey: string; // une par paiement, la même à chaque nouvelle tentative
};

export type ChargeResult =
    | { status: "succeeded"; chargeId: string }
    | { status: "declined"; chargeId: string; reason: string };

export interface PaymentGateway {
    // Un refus (402) est une RÉPONSE, pas une erreur : il est renvoyé, jamais réessayé.
    // Une panne passagère (réseau, 5xx, délai dépassé) est levée en PaymentProviderError.
    charge(request: ChargeRequest): Promise<ChargeResult>;
}

// timeout : délai dépassé → 504 ; error : réseau ou 5xx → 502 (traduits par le service)
export type ProviderFailure = "timeout" | "error";

export class PaymentProviderError extends Error {
    constructor(
        readonly failure: ProviderFailure,
        message: string,
        options?: { cause?: unknown },
    ) {
        super(message, options);
        this.name = "PaymentProviderError";
    }
}
