import { getServerEnv, type ServerEnv } from "@/lib/env";
import { cashfreePaymentProvider } from "./providers/cashfree";
import { mockPaymentProvider } from "./providers/mock";
import { payuPaymentProvider } from "./providers/payu";
import { phonepePaymentProvider } from "./providers/phonepe";
import { razorpayPaymentProvider } from "./providers/razorpay";
import {
  PaymentConfigurationError,
  PaymentProviderError,
  type CreateOrderInput,
  type PaymentProvider,
  type PaymentProviderId,
  type RefundInput,
} from "@/lib/payments/types";

const providers: Record<PaymentProviderId, PaymentProvider> = {
  mock: mockPaymentProvider,
  razorpay: razorpayPaymentProvider,
  cashfree: cashfreePaymentProvider,
  phonepe: phonepePaymentProvider,
  payu: payuPaymentProvider,
};

export function getPaymentEnv(): ServerEnv {
  return getServerEnv();
}

export function listPaymentProviders(): PaymentProvider[] {
  return Object.values(providers);
}

export function getPaymentProvider(id?: PaymentProviderId): PaymentProvider {
  const env = getServerEnv();
  const selected = id ?? (env.PAYMENT_PROVIDER as PaymentProviderId);
  const provider = providers[selected];
  if (!provider) {
    throw new PaymentProviderError(`Unsupported PAYMENT_PROVIDER="${selected}". Use razorpay, cashfree, phonepe, payu, or mock.`, 500);
  }
  return provider;
}

export function getConfiguredPaymentProvider(): PaymentProvider {
  const provider = getPaymentProvider();
  const env = getServerEnv();
  provider.assertConfigured(env);
  return provider;
}

export function reportMissingPaymentCredentials(env: ServerEnv = getServerEnv()) {
  const provider = getPaymentProvider(env.PAYMENT_PROVIDER as PaymentProviderId);
  return {
    provider: provider.id,
    displayName: provider.displayName,
    missing: provider.missingCredentials(env),
  };
}

/** Backward-compatible helpers used by existing routes. */
export async function createProviderOrder(input: CreateOrderInput) {
  const env = getServerEnv();
  const provider = getPaymentProvider();
  const result = await provider.createOrder(input, env);
  return {
    ...result,
    orderId: result.providerOrderId,
    keyId:
      result.keyId ||
      (result.checkout.mode === "razorpay_modal"
        ? result.checkout.keyId
        : result.checkout.mode === "mock"
          ? "mock"
          : provider.id),
  };
}

export async function createProviderRefund(input: RefundInput) {
  const env = getServerEnv();
  // Refund through the payment's original provider — never the currently selected gateway alone.
  const provider = getPaymentProvider(input.provider ?? (env.PAYMENT_PROVIDER as PaymentProviderId));
  return provider.createRefund(input, env);
}

export function mapPaymentError(error: unknown): { status: number; error: string; missing?: string[] } {
  if (error instanceof PaymentConfigurationError) {
    return {
      status: 503,
      error: `Payment gateway (${error.message.split(" ")[0]}) is not configured. Missing: ${error.missing.join(", ")}.`,
      missing: error.missing,
    };
  }
  if (error instanceof PaymentProviderError) {
    return { status: error.statusHint ?? 502, error: error.message };
  }
  const message = error instanceof Error ? error.message : "unknown";
  if (message === "INVALID_ORIGIN") {
    return { status: 403, error: "Please reload this page on www.vploanconnect.in and try again." };
  }
  if (message.includes("Mock payments are disabled")) {
    return { status: 503, error: "Mock payments are disabled in production. Set PAYMENT_PROVIDER to a live gateway." };
  }
  if (message.includes("Invalid payment amount")) {
    return { status: 400, error: message };
  }
  return { status: 500, error: "Unable to open checkout right now. Please try again." };
}

export {
  PaymentConfigurationError,
  PaymentProviderError,
  type CreateOrderInput,
  type CreateOrderResult,
  type CheckoutDescriptor,
  type PaymentProvider,
  type PaymentProviderId,
} from "@/lib/payments/types";
