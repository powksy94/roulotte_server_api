import { PaymentProviderError, type ChargeRequest, type ChargeResult, type PaymentGateway } from "./payment-gateway.js";

// Faux prestataire (choisi par la Factory quand PAYMENT_PROVIDER=fake) : se comporte comme le simulateur,
// sans réseau, et garde chaque appel reçu pour que les tests puissent vérifier
export class FakePaymentGateway implements PaymentGateway {
    readonly calls: ChargeRequest[] = [];
    private readonly byKey = new Map<string, ChargeResult>();

    // Nombre de débits réels : une même Idempotency-Key ne débite qu'une fois
    get debits() {
        return [...this.byKey.values()].filter((r) => r.status === "succeeded").length;
    }

    async charge(request: ChargeRequest): Promise<ChargeResult> {
        this.calls.push(request);
        const replay = this.byKey.get(request.idempotencyKey);
        if (replay) return replay; // même clé → même réponse, pas de nouveau débit

        const chargeId = `ch_fake_${this.calls.length}`;
        switch (request.token) {
            case "tok_visa":
                return this.remember(request, { status: "succeeded", chargeId });
            case "tok_flaky":
                // Le paiement EST enregistré, mais la réponse se perd
                this.remember(request, { status: "succeeded", chargeId });
                throw new PaymentProviderError("error", "Paiement enregistré, réponse perdue (faux)");
            case "tok_down":
                throw new PaymentProviderError("error", "Prestataire en panne (faux)");
            case "tok_slow":
                throw new PaymentProviderError("timeout", "Prestataire trop lent (faux)");
            default:
                return this.remember(request, {
                    status: "declined",
                    chargeId,
                    reason: request.token === "tok_declined" ? "insufficient_funds" : "unknown_token",
                });
        }
    }

    private remember(request: ChargeRequest, result: ChargeResult) {
        this.byKey.set(request.idempotencyKey, result);
        return result;
    }
}
