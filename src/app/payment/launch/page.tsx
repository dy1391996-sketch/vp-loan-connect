import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";
import { CashfreeLaunchClient } from "@/components/checkout/cashfree-launch-client";
import { PublicStatePanel } from "@/components/ui/public-state-panel";
import { prisma } from "@/lib/db";
import { fetchCashfreeOrder, resolveCashfreeEnv } from "@/lib/payments/providers/cashfree";
import { isReusableCashfreeOrderStatus } from "@/lib/payments/cashfree-browser";
import { getServerEnv } from "@/lib/env";
import { verifyAccessToken } from "@/lib/security/tokens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Opening Secure Payment", robots: { index: false, follow: false } };

export default async function PaymentLaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ internalOrderId?: string; token?: string }>;
}) {
  const query = await searchParams;
  if (!query.internalOrderId || !query.token) return <InvalidLaunch />;

  let token;
  try {
    token = await verifyAccessToken(query.token, "result_access");
  } catch {
    return <InvalidLaunch />;
  }

  const order = await prisma.order.findUnique({
    where: { id: query.internalOrderId },
    include: {
      product: { select: { slug: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1, select: { provider: true } },
    },
  });
  if (!order || order.leadId !== token.leadId || !order.assessmentId || token.sub !== order.assessmentId) {
    return <InvalidLaunch />;
  }
  if (order.status === "PAID") {
    return (
      <PublicStatePanel
        icon={LockKeyhole}
        eyebrow="Secure payment"
        title="Payment already completed"
        description="This order is already paid. Return to your result page to access the Credit Profile Booster."
        action={{ href: `/result/${order.assessmentId}`, label: "Back to result" }}
      />
    );
  }
  if (!order.providerOrderId || order.payments[0]?.provider !== "cashfree") {
    return <InvalidLaunch />;
  }

  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER !== "cashfree") return <InvalidLaunch />;

  let paymentSessionId = "";
  try {
    const snapshot = await fetchCashfreeOrder(order.providerOrderId, env);
    const status = String(snapshot.order_status || "").toUpperCase();
    if (status === "PAID") {
      return (
        <PublicStatePanel
          icon={LockKeyhole}
          eyebrow="Secure payment"
          title="Payment already completed"
          description="Cashfree shows this order as paid. Return to your result page while we finish verification."
          action={{ href: `/result/${order.assessmentId}`, label: "Back to result" }}
        />
      );
    }
    if (!isReusableCashfreeOrderStatus(status) || !snapshot.payment_session_id) {
      return (
        <PublicStatePanel
          icon={LockKeyhole}
          eyebrow="Secure payment"
          title="Payment session expired"
          description="This payment session can no longer be resumed. Start a fresh secure payment from checkout."
          action={{
            href: `/checkout?product=${order.product.slug}&assessment=${order.assessmentId}&token=${encodeURIComponent(query.token)}`,
            label: "Back to checkout",
          }}
        />
      );
    }
    paymentSessionId = snapshot.payment_session_id;
  } catch {
    return (
      <PublicStatePanel
        icon={LockKeyhole}
        eyebrow="Secure payment"
        title="Unable to open payment"
        description="We could not reach Cashfree to resume this session. Try again in a moment."
        action={{
          href: `/checkout?product=${order.product.slug}&assessment=${order.assessmentId}&token=${encodeURIComponent(query.token)}`,
          label: "Back to checkout",
        }}
      />
    );
  }

  return (
    <section className="surface-grid grid min-h-screen place-items-center bg-surface py-10 sm:py-16">
      <div className="page-shell w-full">
        <CashfreeLaunchClient
          paymentSessionId={paymentSessionId}
          env={resolveCashfreeEnv(env)}
          internalOrderId={order.id}
          assessmentId={order.assessmentId}
          productSlug={order.product.slug}
          resultToken={query.token}
          orderReference={order.orderReference}
        />
      </div>
    </section>
  );
}

function InvalidLaunch() {
  return (
    <PublicStatePanel
      icon={LockKeyhole}
      eyebrow="Secure payment"
      title="Secure payment link required"
      description="Open checkout from your eligibility result and tap Proceed to secure payment."
      action={{ href: "/apply/quick", label: "Start quick apply" }}
    />
  );
}
