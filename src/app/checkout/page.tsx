import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";
import { CheckoutClient } from "@/components/checkout/checkout-client";
import { PublicStatePanel } from "@/components/ui/public-state-panel";
import { USP_PRICE_LABEL, USP_PRODUCT_NAME, USP_PRODUCT_SLUG, USP_SALE_PRICE } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { verifyAccessToken } from "@/lib/security/tokens";
import { formatInrExact } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Secure ${USP_PRICE_LABEL} Checkout`, robots: { index: false, follow: false } };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; assessment?: string; token?: string }>;
}) {
  const query = await searchParams;
  if (!query.product || !query.assessment || !query.token) return <InvalidCheckout />;
  let token;
  try {
    token = await verifyAccessToken(query.token, "result_access");
  } catch {
    return <InvalidCheckout />;
  }
  if (token.sub !== query.assessment) return <InvalidCheckout />;
  const [assessment, product] = await Promise.all([
    prisma.assessment.findUnique({ where: { id: query.assessment }, include: { lead: true } }),
    prisma.product.findUnique({ where: { slug: query.product } }),
  ]);
  if (!assessment || assessment.leadId !== token.leadId || !product?.active) return <InvalidCheckout />;
  const subtotal = product.slug === USP_PRODUCT_SLUG ? USP_SALE_PRICE : Number(product.salePrice);
  const gst = Math.round(subtotal * Number(product.gstRate)) / 100;
  const total = Math.round((subtotal + gst) * 100) / 100;

  return (
    <section className="surface-grid min-h-screen bg-surface py-10 sm:py-16">
      <div className="page-shell">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">Secure payment</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-navy-950 sm:text-4xl">
              Review your {USP_PRICE_LABEL} {USP_PRODUCT_NAME}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Review the fee and GST, then tap the button to open the secure Cashfree payment page. Payment never starts
              automatically, and you are charged once.
            </p>
          </div>
          <CheckoutClient
            assessmentId={assessment.id}
            productSlug={product.slug}
            resultToken={query.token}
            productName={product.name}
            subtotal={formatInrExact(subtotal)}
            gst={formatInrExact(gst)}
            total={formatInrExact(total)}
            customerName={assessment.lead.fullName}
            customerMobile={assessment.lead.mobile}
            referralCode={assessment.referralCode ?? undefined}
          />
        </div>
      </div>
    </section>
  );
}

function InvalidCheckout() {
  return (
    <PublicStatePanel
      icon={LockKeyhole}
      eyebrow="Secure checkout"
      title="Secure payment link required"
      description="Complete the short profile and unlock step first so we can open secure payment."
      action={{ href: "/apply/quick", label: "Start quick apply" }}
    />
  );
}
