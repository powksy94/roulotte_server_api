import { PaymentProviderError, type ChargeRequest, type ChargeResult, type PaymentGateway } from "./payment-gateway.js";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type RetryOptions = {
    maxAttempts: number;
    baseDelayMs: number; // attente avant la 2e tentative, doublée ensuite
    onRetry?: (attempt: number, error: PaymentProviderError) => void;
};

// Decorator : même interface que le prestataire qu'il enveloppe, avec les nouvelles tentatives en plus.
// La MÊME requête est rejouée, donc la MÊME Idempotency-Key : le prestataire ne débite qu'une fois
export class RetryingPaymentGateway implements PaymentGateway {
    constructor(
        private readonly inner: PaymentGateway,
        private readonly options: RetryOptions,
    ) {}

    async charge(request: ChargeRequest): Promise<ChargeResult> {
        for (let attempt = 1; ; attempt++) {
            try {
                // Un refus (declined) est une réponse normale : renvoyé tel quel, jamais réessayé
                return await this.inner.charge(request);
            } catch (error) {
                // Seules les pannes passagères (réseau, 5xx, délai) se réessaient
                if (!(error instanceof PaymentProviderError) || attempt >= this.options.maxAttempts) throw error;
                this.options.onRetry?.(attempt, error);
                await sleep(this.options.baseDelayMs * 2 ** (attempt - 1));
            }
        }
    }
}
