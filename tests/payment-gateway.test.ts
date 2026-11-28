import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HttpPaymentGateway } from "../src/modules/payments/http-payment-gateway.js";
import { createPaymentGateway } from "../src/modules/payments/payment-gateway.factory.js";
import { PaymentProviderError, type ChargeRequest, type PaymentGateway } from "../src/modules/payments/payment-gateway.js";
import { RetryingPaymentGateway } from "../src/modules/payments/retrying-payment-gateway.js";
import { testConfig } from "./helpers/test-app.js";

const request = (token: string, idempotencyKey = "cle-1"): ChargeRequest => ({
  amountCents: 800, reference: "order-42", token, idempotencyKey,
});

// Un petit prestataire local, pour tester l'Adapter sur du vrai HTTP
describe("HttpPaymentGateway (Adapter, face à un faux prestataire HTTP)", () => {
  let server: Server;
  let gateway: HttpPaymentGateway;
  let last: { method?: string; url?: string; headers: IncomingHttpHeaders; body: Record<string, unknown> } | undefined;

  beforeAll(async () => {
    server = createServer(async (req, res) => {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw || "{}");
      last = { method: req.method, url: req.url, headers: req.headers, body };
      const reply = (status: number, payload: unknown) => {
        if (res.destroyed) return;
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      };
      switch (body.token) {
        case "tok_visa": return reply(201, { id: "ch_1", status: "succeeded" });
        case "tok_declined": return reply(402, { id: "ch_2", status: "declined", declineReason: "insufficient_funds" });
        case "tok_down": return reply(500, { error: { type: "api_error" } });
        case "tok_bad_body": return reply(201, { inattendu: true });
        case "tok_bad_key": return reply(401, { error: { type: "authentication_error" } });
        case "tok_reset": return req.socket.destroy();
        case "tok_slow": setTimeout(() => reply(201, { id: "ch_3", status: "succeeded" }), 300); return;
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    gateway = new HttpPaymentGateway({ baseUrl: `http://127.0.0.1:${port}`, apiKey: "sk_test", timeoutMs: 100 });
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("201 → succeeded ; envoie la clé secrète, l'Idempotency-Key et le corps attendu par le prestataire", async () => {
    expect(await gateway.charge(request("tok_visa"))).toEqual({ status: "succeeded", chargeId: "ch_1" });
    expect(last?.method).toBe("POST");
    expect(last?.url).toBe("/v1/charges");
    expect(last?.headers.authorization).toBe("Bearer sk_test");
    expect(last?.headers["idempotency-key"]).toBe("cle-1");
    expect(last?.body).toEqual({ amountCents: 800, currency: "EUR", reference: "order-42", token: "tok_visa" });
  });

  it("402 → declined avec la raison (une réponse, pas une erreur)", async () => {
    expect(await gateway.charge(request("tok_declined"))).toEqual({ status: "declined", chargeId: "ch_2", reason: "insufficient_funds" });
  });

  it("5xx, connexion coupée, réponse mal formée → PaymentProviderError « error »", async () => {
    for (const token of ["tok_down", "tok_reset", "tok_bad_body"]) {
      await expect(gateway.charge(request(token))).rejects.toMatchObject({ name: "PaymentProviderError", failure: "error" });
    }
  });

  it("délai dépassé → PaymentProviderError « timeout » (AbortSignal.timeout)", async () => {
    await expect(gateway.charge(request("tok_slow"))).rejects.toMatchObject({ failure: "timeout" });
  });

  it("401 (mauvaise clé) → erreur de configuration, pas une panne à réessayer", async () => {
    const error = await gateway.charge(request("tok_bad_key")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(PaymentProviderError);
  });
});

// Un prestataire programmé : chaque appel consomme le comportement suivant
function scripted(...steps: ("ok" | "declined" | "error" | "timeout" | "bug")[]) {
  const calls: ChargeRequest[] = [];
  const inner: PaymentGateway = {
    async charge(req) {
      calls.push(req);
      const step = steps[calls.length - 1] ?? "ok";
      if (step === "ok") return { status: "succeeded", chargeId: "ch_ok" };
      if (step === "declined") return { status: "declined", chargeId: "ch_ko", reason: "insufficient_funds" };
      if (step === "bug") throw new Error("bug");
      throw new PaymentProviderError(step, step);
    },
  };
  return { calls, gateway: new RetryingPaymentGateway(inner, { maxAttempts: 3, baseDelayMs: 0 }) };
}

describe("RetryingPaymentGateway (nouvelles tentatives)", () => {
  it("réessaie une panne passagère avec la MÊME Idempotency-Key", async () => {
    const { calls, gateway } = scripted("error", "ok");
    expect(await gateway.charge(request("tok_flaky", "cle-unique"))).toMatchObject({ status: "succeeded" });
    expect(calls.map((c) => c.idempotencyKey)).toEqual(["cle-unique", "cle-unique"]);
  });

  it("s'arrête après 3 tentatives et garde la nature de la panne (timeout)", async () => {
    const { calls, gateway } = scripted("timeout", "timeout", "timeout", "ok");
    await expect(gateway.charge(request("tok_slow"))).rejects.toMatchObject({ failure: "timeout" });
    expect(calls).toHaveLength(3);
  });

  it("un refus n'est jamais réessayé", async () => {
    const { calls, gateway } = scripted("declined", "ok");
    expect(await gateway.charge(request("tok_declined"))).toMatchObject({ status: "declined" });
    expect(calls).toHaveLength(1);
  });

  it("une erreur qui n'est pas une panne du prestataire n'est pas réessayée", async () => {
    const { calls, gateway } = scripted("bug", "ok");
    await expect(gateway.charge(request("tok_visa"))).rejects.toThrow("bug");
    expect(calls).toHaveLength(1);
  });
});

describe("createPaymentGateway (Factory)", () => {
  it("PAYMENT_PROVIDER=fake : aucun réseau, nouvelles tentatives branchées, tok_flaky réussit", async () => {
    const gateway = createPaymentGateway({ ...testConfig, PAYMENT_PROVIDER: "fake" }, { warn: () => {} });
    expect(gateway).toBeInstanceOf(RetryingPaymentGateway);
    expect(await gateway.charge(request("tok_flaky"))).toMatchObject({ status: "succeeded" });
  });
});
