import type { Metadata } from "next";
import { CheckCircle2, FileText, ReceiptText, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PublicStatePanel } from "@/components/ui/public-state-panel";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { verifyAccessToken } from "@/lib/security/tokens";
import { formatInr } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment Successful", robots: { index: false, follow: false } };

export default async function PaymentSuccessPage({ searchParams }: { searchParams: Promise<{ order?: string; report?: string; token?: string }> }) {
  const query = await searchParams;
  if (!query.order || !query.report || !query.token) return <InvalidSuccess />;
  let access;
  try {
    access = await verifyAccessToken(query.token, "report_access");
    if (access.sub !== query.report) throw new Error("Report token mismatch");
  } catch {
    return <InvalidSuccess />;
  }

  const report = await prisma.report.findUnique({ where: { id: query.report }, include: { order: { include: { product: true, lead: true } } } });
  if (
    !report
    || report.order.orderReference !== query.order
    || report.order.status !== "PAID"
    || access.leadId !== report.leadId
    || access.orderId !== report.orderId
  ) return <InvalidSuccess />;
  const env = getServerEnv();

  return (
    <section className="surface-grid min-h-[75vh] bg-surface py-14 sm:py-18">
      <div className="page-shell">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[2rem] border border-line/80 bg-white p-7 shadow-soft sm:p-10">
            <span className="grid h-16 w-16 place-items-center rounded-3xl bg-brand-100 text-brand-700"><CheckCircle2 size={31} /></span>
            <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">Payment confirmed</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-navy-950 sm:text-4xl">Payment Successfulतापूर्वक सत्यापित हुआ</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">Your personalized loan match plan is ready. This is not a loan sanction or lender fee.</p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <Info icon={ReceiptText} label="Order reference" value={report.order.orderReference} />
              <Info icon={FileText} label="Report reference" value={report.reportReference} />
              <Info label="Service" value={report.order.product.name} />
              <Info label="Amount paid" value={formatInr(Number(report.order.totalAmount))} />
            </div>
            <ButtonLink href={`/report/${report.id}?token=${encodeURIComponent(query.token)}`} size="lg" className="mt-7 w-full">Open secure matches <FileText size={18} /></ButtonLink>
          </div>
          <div className="mt-5 rounded-3xl border border-line bg-white p-6 shadow-sm">
            <h2 className="font-extrabold text-navy-950">Invoice information</h2>
            <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-600">
              <p><strong>Business name:</strong> {env.BUSINESS_NAME}</p>
              {env.BUSINESS_GSTIN ? <p><strong>GSTIN:</strong> {env.BUSINESS_GSTIN}</p> : null}
              {env.BUSINESS_ADDRESS ? <p><strong>Registered office:</strong> {env.BUSINESS_ADDRESS}</p> : null}
              <p><strong>Support email:</strong> {env.SUPPORT_EMAIL}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Info({ icon: Icon, label, value }: { icon?: typeof FileText; label: string; value: string }) {
  return <div className="rounded-2xl bg-surface p-5">{Icon ? <Icon className="mb-3 text-brand-700" size={18} /> : null}<p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 break-words font-extrabold text-navy-950">{value}</p></div>;
}

function InvalidSuccess() {
  return <PublicStatePanel icon={ShieldCheck} eyebrow="Payment verification" title="A verified payment link is required" description="Open the confirmation returned after secure server-side payment verification." action={{ href: "/contact", label: "Contact support" }} />;
}
