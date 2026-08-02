import type { ServerEnv } from "@/lib/env";
import {
  PaymentConfigurationError,
  PaymentProviderError,
  type CreateOrderInput,
  type PaymentProvider,
  type PaymentStatusResult,
  type RefundInput,
} from "@/lib/payments/types";

export const mockPaymentProvider: PaymentProvider = {
  id: "mock",
  displayName: "Mock (local only)",

  missingCredentials() {
    return [];
  },

  assertConfigured(env) {
    if (env.NODE_ENV === "production") {
      throw new PaymentProviderError("Mock payments are disabled in production.", 503);
    }
  },

  async createOrder(input: CreateOrderInput, env: ServerEnv) {
    this.assertConfigured(env);
    const amountPaise = Math.round(input.amountPaise);
    if (!Number.isFinite(amountPaise) || amountPaise < 100) {
      throw new PaymentProviderError(`Invalid payment amount (${amountPaise} paise).`, 400);
    }
    const orderId = `mock_order_${crypto.randomUUID()}`;
    return {
      provider: "mock" as const,
      providerOrderId: orderId,
      amountPaise,
      currency: "INR" as const,
      keyId: "mock",
      checkout: { mode: "mock" as const },
    };
  },

  async verifyClientPayment() {
    return { ok: false as const, reason: "Mock payments use /api/payments/mock-complete instead of client verify." };
  },

  verifyWebhookSignature() {
    return false;
  },

  parseWebhook() {
    return { kind: "ignored" as const, reason: "mock_has_no_webhooks" };
  },

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    return { providerPaymentId, status: "captured", rawStatus: "mock_captured" };
  },

  async createRefund(input: RefundInput, env: ServerEnv) {
    this.assertConfigured(env);
    if (!input.paymentId) throw new PaymentConfigurationError("mock", ["paymentId"]);
    return { refundId: `mock_refund_${crypto.randomUUID()}` };
  },
};
