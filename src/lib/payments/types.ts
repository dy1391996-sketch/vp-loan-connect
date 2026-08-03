import type { ServerEnv } from "@/lib/env";

export type PaymentProviderId = "mock" | "razorpay" | "cashfree" | "phonepe" | "payu";

export type CheckoutMode = "mock" | "razorpay_modal" | "cashfree_checkout" | "phonepe_redirect" | "payu_hosted";

export type CheckoutDescriptor =
  | { mode: "mock" }
  | { mode: "razorpay_modal"; keyId: string; orderId: string }
  | { mode: "cashfree_checkout"; paymentSessionId: string; env: "sandbox" | "production" }
  | { mode: "phonepe_redirect"; redirectUrl: string }
  | { mode: "payu_hosted"; actionUrl: string; fields: Record<string, string> };

export type CreateOrderInput = {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
  customer?: { name?: string; email?: string; mobile?: string };
  returnUrl?: string;
  notifyUrl?: string;
};

export type CreateOrderResult = {
  provider: PaymentProviderId;
  providerOrderId: string;
  amountPaise: number;
  currency: "INR";
  checkout: CheckoutDescriptor;
  /** @deprecated Prefer checkout.keyId when mode is razorpay_modal */
  keyId?: string;
};

export type ClientVerifyPayload = {
  internalOrderId: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  signature?: string;
  /** Server-trusted expected amount in paise (never from the browser). */
  expectedAmountPaise?: number;
  /** Provider-specific fields (Razorpay handler, Cashfree order_id, PayU hash, etc.) */
  raw?: Record<string, unknown>;
};

export type ClientVerifySuccess = {
  ok: true;
  providerOrderId: string;
  providerPaymentId: string;
};

export type ClientVerifyFailure = {
  ok: false;
  reason: string;
};

export type PaymentStatusResult = {
  providerPaymentId: string;
  providerOrderId?: string;
  status: "created" | "authorized" | "captured" | "failed" | "refunded" | "unknown";
  rawStatus?: string;
};

export type WebhookParseResult =
  | { kind: "ignored"; reason: string }
  | {
      kind: "payment_captured";
      providerEventId: string;
      providerOrderId: string;
      providerPaymentId: string;
    }
  | {
      kind: "payment_failed";
      providerEventId: string;
      providerOrderId: string;
      providerPaymentId?: string;
      failureCode?: string;
      failureDescription?: string;
    };

export type RefundInput = {
  paymentId: string;
  /** Merchant/provider order id — required for Cashfree refunds. */
  providerOrderId?: string;
  amountPaise: number;
  refundReference: string;
  /** Original payment provider — required when PAYMENT_PROVIDER has changed. */
  provider?: PaymentProviderId;
};

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly displayName: string;
  missingCredentials(env: ServerEnv): string[];
  assertConfigured(env: ServerEnv): void;
  createOrder(input: CreateOrderInput, env: ServerEnv): Promise<CreateOrderResult>;
  verifyClientPayment(payload: ClientVerifyPayload, orderProviderOrderId: string | null, env: ServerEnv): Promise<ClientVerifySuccess | ClientVerifyFailure>;
  verifyWebhookSignature(rawBody: string, headers: Headers, env: ServerEnv): boolean;
  parseWebhook(rawBody: string, headers: Headers, env: ServerEnv): WebhookParseResult;
  getPaymentStatus(providerPaymentId: string, env: ServerEnv): Promise<PaymentStatusResult>;
  createRefund(input: RefundInput, env: ServerEnv): Promise<{ refundId: string }>;
}

export class PaymentConfigurationError extends Error {
  readonly missing: string[];

  constructor(provider: PaymentProviderId, missing: string[]) {
    super(`${provider} is not configured. Missing: ${missing.join(", ")}`);
    this.name = "PaymentConfigurationError";
    this.missing = missing;
  }
}

export class PaymentProviderError extends Error {
  readonly statusHint?: number;

  constructor(message: string, statusHint?: number) {
    super(message);
    this.name = "PaymentProviderError";
    this.statusHint = statusHint;
  }
}
