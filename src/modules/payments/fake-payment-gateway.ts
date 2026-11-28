import {
  PaymentProviderError,
  type ChargeRequest,
  type ChargeResult,
  type PaymentGateway,
} from "../../src/modules/payments/payment-gateway.js";

// Faux prestataire : se comporte selon le jeton, comme le simulateur, et garde chaque appel reçu
export class FakePaymentGateway implements PaymentGateway {
  readonly calls: ChargeRequest[] = [];

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    this.calls.push(request);
    const chargeId = `ch_fake_${this.calls.length}`;
    switch (request.token) {
      case "tok_visa":
        return { status: "succeeded", chargeId };
      case "tok_down":
        throw new PaymentProviderError("error", "Prestataire en panne (faux)");
      case "tok_slow":
        throw new PaymentProviderError("timeout", "Prestataire trop lent (faux)");
      default:
        return { status: "declined", chargeId, reason: "insufficient_funds" };
    }
  }
}
