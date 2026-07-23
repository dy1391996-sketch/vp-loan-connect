import type { Metadata } from "next";
import { ArrowUpRight, CircleDollarSign, MousePointerClick, ReceiptText, ShieldCheck, UserRoundCheck } from "lucide-react";
import { ReferralActions } from "@/components/referral-dashboard-client";
import { PublicStatePanel } from "@/components/ui/public-state-panel";
import { prisma } from "@/lib/db";
import { getPublicAppUrl } from "@/lib/env";
import { verifyAccessToken } from "@/lib/security/tokens";
import { formatInr } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Referral Dashboard", robots: { index: false, follow: false } };

export default async function ReferralDashboardPage({ searchParams }: { searchParams: Promise<{ assessment?: string; token?: string }> }) {
  const query = await searchParams;
  if (!query.assessment || !query.token) return <Restricted />;

  let payload;
  try {
    payload = await verifyAccessToken(query.token, "result_access");
  } catch {
    return <Restricted />;
  }
  if (payload.sub !== query.assessment || typeof payload.leadId !== "string") return <Restricted />;

  const lead = await prisma.lead.findUnique({
    where: { id: payload.leadId },
    include: { referralClicks: true, outgoingReferrals: true, referralRewards: true },
  });
  if (!lead) return <Restricted />;

  const successful = lead.referralRewards.filter((reward) => ["PENDING", "APPROVED", "PAID"].includes(reward.status)).length;
  const sum = (status: string) => lead.referralRewards.filter((reward) => reward.status === status).reduce((total, reward) => total + Number(reward.amount), 0);
  const link = `${getPublicAppUrl()}/r/${lead.referralCode}`;

  return (
    <section className="surface-grid min-h-screen bg-surface py-12 sm:py-16">
      <div className="page-shell">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] bg-navy-950 p-7 text-white shadow-soft sm:p-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-500">VP Refer & Earn</p>
            <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl">Your referral dashboard</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">Share responsibly and follow validated purchases, pending rewards and completed payouts.</p>
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur sm:p-6">
              <p className="text-xs font-semibold text-slate-300">Your secure referral link</p>
              <p className="mt-2 break-all font-bold text-white">{link}</p>
              <ReferralActions link={link} />
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={MousePointerClick} label="Total clicks" value={String(lead.referralClicks.length)} />
            <Metric icon={UserRoundCheck} label="Registrations" value={String(lead.outgoingReferrals.length)} />
            <Metric icon={ReceiptText} label="Successful purchases" value={String(successful)} />
            <Metric icon={CircleDollarSign} label="Pending reward" value={formatInr(sum("PENDING"))} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Metric icon={CircleDollarSign} label="Approved reward" value={formatInr(sum("APPROVED"))} />
            <Metric icon={CircleDollarSign} label="Paid reward" value={formatInr(sum("PAID"))} />
          </div>

          <div className="mt-8">
            <div className="flex items-end justify-between gap-5">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-700">Reward history</p><h2 className="mt-2 text-2xl font-extrabold text-navy-950">Your qualifying activity</h2></div>
            </div>
            {lead.referralRewards.length ? (
              <div className="mt-5 grid gap-3">
                {lead.referralRewards.map((reward) => (
                  <article key={reward.id} className="grid gap-4 rounded-3xl border border-line bg-white p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
                    <div className="flex items-start gap-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700"><ArrowUpRight size={19} /></span>
                      <div>
                        <p className="font-extrabold text-navy-950">{formatInr(Number(reward.amount))} reward</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{reward.createdAt.toLocaleDateString("en-IN")} · Order {reward.orderId.slice(0, 8)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className="rounded-full bg-surface px-3 py-2 text-xs font-extrabold text-navy-900">{reward.status}</span>
                      {reward.payoutReference ? <span className="text-xs text-slate-500">{reward.payoutReference}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-dashed border-line bg-white p-10 text-center">
                <CircleDollarSign className="mx-auto text-brand-700" size={28} />
                <p className="mt-4 font-extrabold text-navy-950">No qualifying rewards yet</p>
                <p className="mt-2 text-sm text-slate-500">Validated activity will appear here automatically.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof CircleDollarSign; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Icon size={18} /></span>
      <p className="mt-4 text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-navy-950">{value}</p>
    </div>
  );
}

function Restricted() {
  return <PublicStatePanel icon={ShieldCheck} eyebrow="Referral access" title="Verified profile access required" description="Open the referral dashboard from your secure assessment result." action={{ href: "/assessment", label: "Start free assessment" }} />;
}
