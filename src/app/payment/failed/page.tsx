import type { Metadata } from "next";
import { CircleAlert, CircleX, RefreshCw } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Payment Not Completed", robots: { index: false, follow: false } };

export default async function PaymentFailedPage({ searchParams }: { searchParams: Promise<{ assessment?: string; product?: string; token?: string; reason?: string }> }) {
  const query = await searchParams;
  const retry = query.assessment && query.product && query.token
    ? `/checkout?assessment=${query.assessment}&product=${query.product}&token=${encodeURIComponent(query.token)}`
    : "/assessment";

  return (
    <section className="surface-grid grid min-h-[72vh] place-items-center bg-surface py-16">
      <div className="page-shell">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-line/80 bg-white p-7 text-center shadow-soft sm:p-10">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-red-100 text-red-700"><CircleX size={29} /></span>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-red-700">Payment status</p>
          <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-[-0.045em] text-navy-950">Payment was not completed</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">{query.reason || "No amount is treated as paid until secure server verification succeeds."}</p>
          <ButtonLink href={retry} size="lg" className="mt-7 w-full sm:w-auto"><RefreshCw size={17} />Payment not completed — Try again</ButtonLink>
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-left text-xs leading-6 text-amber-950">
            <CircleAlert className="mt-0.5 shrink-0" size={17} />If your account was debited, do not pay again immediately. Contact support with the gateway reference.
          </div>
        </div>
      </div>
    </section>
  );
}
