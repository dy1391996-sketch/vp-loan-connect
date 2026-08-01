import type { Metadata } from "next";
import { ArrowUpRight, CheckCircle2, Download, FileText, Landmark, LockKeyhole, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { verifyAccessToken } from "@/lib/security/tokens";
import { PublicStatePanel } from "@/components/ui/public-state-panel";
import { ReportActions } from "@/components/report-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "आपकी सुरक्षित Profile Report", robots: { index: false, follow: false } };

type Option = { name: string; description: string; href: string; categories: string[] };

const officialOptions: Option[] = [
  { name: "ICICI Bank Personal Loan", description: "Official bank loan page; अंतिम eligibility और offer bank तय करेगा।", href: "https://www.icicibank.com/Personal-Banking/loans/loans.page", categories: ["Personal Loan"] },
  { name: "Axis Bank Digital Personal Loan", description: "Official bank digital lending information और application options।", href: "https://www.axisbank.com/retail/loans/personal-loan/personal-loan-lsp", categories: ["Personal Loan"] },
  { name: "Tata Capital Personal Loan", description: "Official NBFC loan page; approval profile verification के बाद ही होगा।", href: "https://www.tatacapital.com/personal-loan/50000-personal-loan.html", categories: ["Personal Loan"] },
  { name: "SBI MSME / SME Loan", description: "Business और MSME category के लिए official SBI information page।", href: "https://sbi.co.in/hi/web/business/sme/sme-collection-products", categories: ["Business Loan", "MSME Loan", "Mudra Loan Guidance"] },
  { name: "Official Free CIBIL Report", description: "हर calendar year में एक free CIBIL score और report का official option।", href: "https://www.cibil.com/hi/freecibilscore", categories: ["Credit Health Support"] },
];

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token) return <InvalidReport />;

  let access;
  try {
    access = await verifyAccessToken(token, "report_access");
    if (access.sub !== id) throw new Error("mismatch");
  } catch { return <InvalidReport />; }

  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      lead: true,
      assessment: { include: { score: true } },
      order: { include: { product: true } },
    },
  });

  if (!report || report.order.status !== "PAID" || access.leadId !== report.leadId || access.orderId !== report.orderId) return <InvalidReport />;
  if (report.status === "QUEUED") await prisma.report.update({ where: { id }, data: { status: "READY", generatedAt: new Date() } });

  const categories = asStringArray(report.assessment.score?.suitableCategories);
  const matched = officialOptions.filter((option) => option.categories.some((category) => categories.includes(category)));
  const options = matched.length ? matched : officialOptions.filter((option) => option.name.includes("CIBIL"));

  return (
    <section className="surface-grid min-h-[75vh] bg-surface py-10 sm:py-16">
      <div className="page-shell">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-line/80 bg-white p-7 shadow-soft sm:p-10">
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-3xl bg-brand-100 text-brand-700"><FileText size={26} /></span>
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3.5 py-2 text-xs font-extrabold text-brand-700"><CheckCircle2 size={14} />Report तैयार है</span>
            </div>
            <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">सुरक्षित report</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-navy-950 sm:text-4xl">{report.lead.fullName}, आपकी personalized profile report तैयार है</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">{report.order.product.name} · Reference: {report.reportReference}</p>

            <a href={`/api/reports/${id}/download?token=${encodeURIComponent(token)}`} className="mt-7 flex min-h-15 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 font-extrabold text-white shadow-[0_12px_32px_rgba(10,146,101,0.27)] transition hover:-translate-y-0.5 hover:bg-brand-700">
              <Download size={18} />Detailed PDF report download करें
            </a>
            <ReportActions reportId={id} token={token} />
          </div>

          <div className="mt-6 rounded-[2rem] bg-navy-950 p-7 text-white shadow-card sm:p-10">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-500/15 text-brand-500"><Landmark size={23} /></span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-500">आपकी profile के अनुसार</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">Official loan application options</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">नीचे केवल official bank/NBFC pages दिए गए हैं। Link खोलने पर आप अपनी इच्छा से apply करेंगे; VP Loan Connect आपकी जानकारी अपने-आप किसी lender को नहीं भेजता।</p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {options.map((option) => (
                <a key={option.name} href={option.href} target="_blank" rel="noreferrer" className="group rounded-3xl border border-white/10 bg-white/8 p-6 transition hover:-translate-y-0.5 hover:border-brand-500/50">
                  <div className="flex items-start justify-between gap-4"><ShieldCheck className="text-brand-500" size={22} /><ArrowUpRight className="text-slate-400 transition group-hover:text-brand-500" size={20} /></div>
                  <h3 className="mt-5 text-lg font-extrabold">{option.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{option.description}</p>
                  <p className="mt-4 text-xs font-bold text-brand-500">Official website खोलें</p>
                </a>
              ))}
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-xs leading-6 text-slate-300">
              <LockKeyhole className="mt-0.5 shrink-0 text-brand-500" size={17} />
              कई जगह एक साथ apply न करें। हर application credit enquiry बना सकती है। अंतिम eligibility, rate, fees और approval संबंधित lender तय करता है।
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function asStringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function InvalidReport() { return <PublicStatePanel icon={LockKeyhole} eyebrow="सुरक्षित report" title="सही access link जरूरी है" description="यह link गलत, expire या paid report से अलग है।" action={{ href: "/contact", label: "Support से संपर्क करें" }} />; }
