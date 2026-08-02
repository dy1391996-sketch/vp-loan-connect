import { getServerEnv } from "@/lib/env";

export type PaymentLinkResult = {
  provider: "mock" | "razorpay";
  orderId: string;
  paymentLinkId?: string;
  shortUrl: string;
  raw?: unknown;
};

export async function createPaymentLink(input: {
  amountInr: number;
  description: string;
  customer: { name?: string; contact?: string; email?: string };
  notes: Record<string, string>;
  callbackUrl?: string;
}): Promise<PaymentLinkResult> {
  const env = getServerEnv();
  const amountPaise = Math.round(input.amountInr * 100);
  if (amountPaise < 100) throw new Error("Amount too small.");

  if (env.PAYMENT_PROVIDER === "mock") {
    if (env.NODE_ENV === "production") throw new Error("Mock payments disabled in production.");
    const id = `mock_pl_${crypto.randomUUID()}`;
    return {
      provider: "mock",
      orderId: `mock_order_${crypto.randomUUID()}`,
      paymentLinkId: id,
      shortUrl: `${env.NEXT_PUBLIC_APP_URL}/api/admin/payments/mock-pay?link=${id}`,
      raw: { mock: true },
    };
  }

  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials are not configured.");
  }

  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      accept_partial: false,
      description: input.description,
      customer: {
        name: input.customer.name,
        contact: input.customer.contact?.replace("+", ""),
        email: input.customer.email,
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: input.notes,
      callback_url: input.callbackUrl,
      callback_method: "get",
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Razorpay payment link failed (${response.status}).`);
  }

  const data = (await response.json()) as {
    id: string;
    short_url: string;
    order_id?: string;
  };

  return {
    provider: "razorpay",
    orderId: data.order_id ?? data.id,
    paymentLinkId: data.id,
    shortUrl: data.short_url,
    raw: data,
  };
}
