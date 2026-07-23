import type { Metadata } from "next";
import { CheckCircle2, FileText, ReceiptText } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { verifyAccessToken } from "@/lib/security/tokens";
import { formatInr } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment Successful", robots: { index: false, follow: false } };

export default async function PaymentSuccessPage({ searchParams }: { searchParams: Promise<{ order?: string; report?: string; token?: string }> }) {
  const query = await searchParams;
  if (!query.order || !query.report || !query.token) return <InvalidSuccess />;
  try {
    const payload = await verifyAccessToken(query.token, "report_access");
    if (payload.sub !== query.report) throw new Error("Report token mismatch");
  } catch {
    return <InvalidSuccess />;
  }

  const report = await prisma.report.findUnique({ where: { id: query.report }, include: { order: { include: { product: true, lead: true } } } });
  if (!report || report.order.orderReference !== query.order || report.order.status !== "PAID") return <InvalidSuccess />;
  const env = getServerEnv();

  return (
    <section className="min-h-[75vh] bg-surface py-14">
      <div className="page-shell">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-line bg-white p-7 shadow-soft sm:p-10">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-100 text-brand-700"><CheckCircle2 size={32} /></span>
            <h1 className="mt-6 text-3xl font-bold tracking-[-0.04em] text-navy-950">Payment verified successfully</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">Your personalized report request is confirmed. This is not a loan sanction or lender fee.</p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <Info icon={ReceiptText} label="Order reference" value={report.order.orderReference} />
              <Info icon={FileText} label="Report reference" value={report.reportReference} />
              <Info label="Product" value={report.order.product.name} />
              <Info label="Amount paid" value={formatInr(Number(report.order.totalAmount))} />
            </div>
            <ButtonLink href={`/report/${report.id}?token=${encodeURIComponent(query.token)}`} size="lg" className="mt-7 w-full">Open secure report <FileText size={18} /></ButtonLink>
          </div>
          <div className="mt-5 rounded-2xl border border-line bg-white p-6">
            <h2 className="font-bold text-navy-950">Invoice information</h2>
            <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-600">
              <p><strong>Legal business:</strong> {env.BUSINESS_NAME}</p>
              {env.BUSINESS_GSTIN ? <p><strong>GSTIN:</strong> {env.BUSINESS_GSTIN}</p> : null}
              {env.BUSINESS_ADDRESS ? <p><strong>Business address:</strong> {env.BUSINESS_ADDRESS}</p> : null}
              <p><strong>Support:</strong> {env.SUPPORT_EMAIL}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Info({ icon: Icon, label, value }: { icon?: typeof FileText; label: string; value: string }) {
  return <div className="rounded-2xl bg-surface p-5">{Icon ? <Icon className="mb-3 text-brand-700" size={18} /> : null}<p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-bold text-navy-950">{value}</p></div>;
}

function InvalidSuccess() {
  return <section className="min-h-[65vh] bg-surface py-20"><div className="page-shell"><div className="mx-auto max-w-lg rounded-3xl border border-line bg-white p-8 text-center"><h1 className="text-2xl font-bold text-navy-950">Verified payment link required</h1><p className="mt-3 text-sm leading-7 text-slate-600">Open the confirmation returned by secure server-side payment verification.</p></div></div></section>;
}
