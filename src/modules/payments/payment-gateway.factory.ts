import type { Logger } from "pino";
import type { Config } from "../../config.js";
import { FakePaymentGateway } from "./fake-payment-gateway.js";
import { HttpPaymentGateway } from "./http-payment-gateway.js";
import type { PaymentGateway } from "./payment-gateway.js";
import { RetryingPaymentGateway } from "./retrying-payment-gateway.js";

// Factory : la configuration choisit l'implémentation ; le reste de l'application ne voit que PaymentGateway
export function createPaymentGateway(config: Config, logger: Pick<Logger, "warn">): PaymentGateway {
    const provider =
        config.PAYMENT_PROVIDER === "fake"
            ? new FakePaymentGateway()
            : new HttpPaymentGateway({
                  baseUrl: config.PAYMENT_URL,
                  apiKey: config.PAYMENT_API_KEY,
                  timeoutMs: config.PAYMENT_TIMEOUT_MS,
              });

    return new RetryingPaymentGateway(provider, {
        maxAttempts: config.PAYMENT_MAX_ATTEMPTS,
        baseDelayMs: config.PAYMENT_RETRY_BASE_MS,
        onRetry: (attempt, error) => logger.warn({ attempt, failure: error.failure }, "Paiement : nouvelle tentative"),
    });
}
