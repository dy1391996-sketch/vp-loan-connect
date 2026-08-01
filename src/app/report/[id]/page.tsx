import type { Metadata } from "next";
import { ArrowUpRight, CheckCircle2, Download, FileText, Landmark, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { verifyAccessToken } from "@/lib/security/tokens";
import { PublicStatePanel } from "@/components/ui/public-state-panel";
import { ReportActions } from "@/components/report-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Loan Match Plan", robots: { index: false, follow: false } };

type Option = { name: string; description: string; href: string; audience: Array<"small" | "salaried" | "business" | "strong" | "all">; disclosure: string };

const platformOptions: Option[] = [
  { name: "KreditBee", description: "Digital personal-loan journey for eligible applicants, including smaller ticket requirements.", href: "https://www.kreditbee.in/personal-loan", audience: ["small", "salaried"], disclosure: "Loan amount, APR and tenure depend on lender assessment." },
  { name: "Fibe", description: "Digital personal loans for salaried applicants. Fibe states loans up to ₹10 lakh, subject to approval.", href: "https://www.fibe.in/personal-loan/", audience: ["small", "salaried"], disclosure: "Official site states rates from 18% p.a.; final KFS governs." },
  { name: "Moneyview", description: "Online personal-loan application with profile-based eligibility and digital processing.", href: "https://moneyview.in/loans/personal-loan", audience: ["small", "salaried"], disclosure: "Check the lender, APR, fees and KFS before accepting." },
  { name: "Buddy Loan", description: "A digital loan marketplace that may connect applicants with partner lenders.", href: "https://www.buddyloan.com/", audience: ["small", "all"], disclosure: "Buddy Loan is a platform/LSP; the actual lender issues the loan." },
  { name: "Paisabazaar", description: "Compare personal-loan offers from participating banks and NBFCs in one journey.", href: "https://www.paisabazaar.com/personal-loan/", audience: ["strong", "salaried", "all"], disclosure: "Offers and rates depend on the selected regulated lender." },
  { name: "Poonawalla Fincorp", description: "Direct NBFC personal-loan application for stronger, verified profiles.", href: "https://poonawallafincorp.com/personal-loan", audience: ["strong", "salaried"], disclosure: "Official rates and approval remain subject to policy and verification." },
  { name: "ZipLoan", description: "Digital business-loan option for eligible small-business owners.", href: "https://ziploan.in/", audience: ["business"], disclosure: "Business vintage, turnover and lender verification apply." },
  { name: "Official CIBIL Report", description: "Check your official annual CIBIL score and report before making multiple applications.", href: "https://www.cibil.com/freecibilscore", audience: ["all"], disclosure: "VP Loan Connect cannot create or directly alter a bureau score." },
];

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token) return <InvalidReport />;
  let access;
  try { access = await verifyAccessToken(token, "report_access"); if (access.sub !== id) throw new Error("mismatch"); } catch { return <InvalidReport />; }

  const report = await prisma.report.findUnique({ where: { id }, include: { lead: true, assessment: { include: { score: true } }, order: { include: { product: true } } } });
  if (!report || report.order.status !== "PAID" || access.leadId !== report.leadId || access.orderId !== report.orderId) return <InvalidReport />;
  if (report.status === "QUEUED") await prisma.report.update({ where: { id }, data: { status: "READY", generatedAt: new Date() } });

  const credit = report.assessment.creditRange ?? "UNKNOWN";
  const employment = report.assessment.employmentType ?? "OTHER";
  const isBusiness = ["SELF_EMPLOYED", "BUSINESS_OWNER", "FREELANCER"].includes(employment);
  const strong = ["700_749", "750_PLUS"].includes(credit);
  const tags: Array<"small" | "salaried" | "business" | "strong" | "all"> = ["all", strong ? "strong" : "small", isBusiness ? "business" : "salaried"];
  const options = platformOptions.filter((option) => option.audience.some((audience) => tags.includes(audience))).slice(0, 6);

  return (
    <section className="surface-grid min-h-[75vh] bg-surface py-10 sm:py-16">
      <div className="page-shell"><div className="mx-auto max-w-6xl">
        <div className="rounded-[2.25rem] border border-line/80 bg-white p-7 shadow-soft sm:p-10">
          <div className="flex items-start justify-between gap-4"><span className="grid h-14 w-14 place-items-center rounded-3xl bg-brand-100 text-brand-700"><FileText size={26} /></span><span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3.5 py-2 text-xs font-extrabold text-brand-700"><CheckCircle2 size={14} />Plan unlocked</span></div>
          <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">Secure profile report</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-navy-950 sm:text-5xl">{report.lead.fullName}, your matched loan options are ready.</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">{report.order.product.name} · Reference: {report.reportReference}</p>
          <a href={`/api/reports/${id}/download?token=${encodeURIComponent(token)}`} className="mt-7 flex min-h-15 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 font-extrabold text-white shadow-[0_12px_32px_rgba(10,146,101,0.27)] transition hover:-translate-y-0.5 hover:bg-brand-700"><Download size={18} />Download detailed action plan</a>
          <ReportActions reportId={id} token={token} />
        </div>

        <div className="mt-6 rounded-[2.25rem] bg-navy-950 p-7 text-white shadow-card sm:p-10">
          <div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-500/15 text-brand-500"><Landmark size={23} /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-500">Matched to your profile</p><h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">Verified digital loan platforms</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Choose one suitable platform and complete its own eligibility check. We do not submit your details automatically. The regulated lender—not VP Loan Connect—sets the final amount, APR, fees, tenure and decision.</p></div></div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {options.map((option, index) => <a key={option.name} href={option.href} target="_blank" rel="noreferrer" className="group rounded-3xl border border-white/10 bg-white/8 p-6 transition hover:-translate-y-0.5 hover:border-brand-500/50">
              <div className="flex items-start justify-between gap-4"><span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.15em] text-brand-500">{index === 0 ? <><Sparkles size={15} />Best profile fit</> : "Alternative option"}</span><ArrowUpRight className="text-slate-400 transition group-hover:text-brand-500" size={20} /></div>
              <h3 className="mt-5 text-xl font-extrabold">{option.name}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{option.description}</p><p className="mt-4 rounded-xl bg-white/5 p-3 text-xs leading-5 text-slate-400">{option.disclosure}</p><p className="mt-4 text-xs font-bold text-brand-500">Continue to official platform</p>
            </a>)}
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-xs leading-6 text-slate-300"><LockKeyhole className="mt-0.5 shrink-0 text-brand-500" size={17} />Avoid applying on several platforms at once. Each application may create a credit enquiry. Review the lender name, Key Fact Statement, APR, total charges and repayment schedule before accepting any loan.</div>
        </div>
      </div></div>
    </section>
  );
}

function InvalidReport() { return <PublicStatePanel icon={LockKeyhole} eyebrow="Secure report" title="A valid access link is required" description="This link is invalid, expired or does not match a paid report." action={{ href: "/contact", label: "Contact support" }} />; }
