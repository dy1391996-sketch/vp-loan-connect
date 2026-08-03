import type { Metadata } from "next";
import { Clock3, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PaymentPendingClient } from "@/components/checkout/payment-pending-client";
import { PUBLIC_SUPPORT_EMAIL } from "@/lib/constants";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment Verification Pending", robots: { index: false, follow: false } };

export default async function PaymentPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; assessment?: string; token?: string; reason?: string }>;
}) {
  const query = await searchParams;
  if (!query.order) {
    return (
      <section className="surface-grid grid min-h-[72vh] place-items-center bg-surface py-16">
        <div className="page-shell mx-auto max-w-xl rounded-[2rem] border border-line/80 bg-white p-8 text-center shadow-soft">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-amber-100 text-amber-800">
            <ShieldCheck size={28} />
          </span>
          <h1 className="mt-6 text-3xl font-extrabold tracking-[-0.045em] text-navy-950">Payment reference required</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Open this page from the checkout return flow. Do not pay again until support confirms the service fee status.
          </p>
          <ButtonLink href="/contact" size="lg" className="mt-7">
            Contact support
          </ButtonLink>
        </div>
      </section>
    );
  }

  const order = await prisma.order.findUnique({
    where: { orderReference: query.order },
    select: {
      orderReference: true,
      status: true,
      assessmentId: true,
      reports: { select: { id: true }, take: 1 },
    },
  });

  if (order?.status === "PAID" && order.reports[0] && query.token) {
    // Client will receive report token via status poll when available; soft link for already-paid edge cases.
  }

  return (
    <section className="surface-grid grid min-h-[72vh] place-items-center bg-surface py-16">
      <div className="page-shell">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-line/80 bg-white p-7 text-center shadow-soft sm:p-10">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-amber-100 text-amber-800">
            <Clock3 size={29} />
          </span>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-amber-800">Verification in progress</p>
          <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-[-0.045em] text-navy-950">
            Confirming your service fee payment
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            {query.reason ||
              "Your bank or UPI app may have approved the transfer. We unlock the Credit Profile Booster only after secure server-side verification — never from this page alone."}
          </p>
          <p className="mt-3 text-xs font-semibold text-slate-500">Order reference: {query.order}</p>

          <PaymentPendingClient
            orderReference={query.order}
            resultToken={query.token}
            assessmentId={query.assessment || order?.assessmentId || undefined}
          />

          <div className="mt-6 rounded-2xl bg-surface p-4 text-left text-xs leading-6 text-slate-600">
            <p>
              Do not start another payment while verification is running. If the amount was deducted and this page still shows
              pending after a few minutes, email{" "}
              <a className="font-bold text-brand-700" href={`mailto:${PUBLIC_SUPPORT_EMAIL}`}>
                {PUBLIC_SUPPORT_EMAIL}
              </a>{" "}
              with your order reference.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
