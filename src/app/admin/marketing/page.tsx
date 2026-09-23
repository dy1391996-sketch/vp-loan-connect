import Link from "next/link";
import { Activity, ArrowUpRight, CheckCircle2, CircleAlert, Instagram, Megaphone, MousePointerClick, ShieldCheck, Target, UsersRound } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function utmValue(utm: unknown, key: string) {
  if (!utm || typeof utm !== "object" || Array.isArray(utm)) return null;
  const value = (utm as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function topRows(values: Array<string | null | undefined>, fallback = "Direct / unknown") {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = raw?.trim() || fallback;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

export default async function AdminMarketingPage() {
  const { admin } = await requireAdmin();
  const now = new Date();
  const since7 = new Date(now.getTime() - 7 * DAY);
  const since30 = new Date(now.getTime() - 30 * DAY);

  const [
    leads30,
    leads7,
    verified30,
    assessments30,
    paid30,
    consented30,
    optedOut30,
    events30,
    revenue30,
  ] = await Promise.all([
    prisma.lead.findMany({
      where: { deletedAt: null, createdAt: { gte: since30 } },
      select: { source: true, utm: true, stage: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.lead.count({ where: { deletedAt: null, createdAt: { gte: since7 } } }),
    prisma.lead.count({ where: { deletedAt: null, mobileVerifiedAt: { gte: since30 } } }),
    prisma.assessment.count({ where: { status: "COMPLETED", completedAt: { gte: since30 } } }),
    prisma.order.count({ where: { status: "PAID", paidAt: { gte: since30 } } }),
    prisma.consentLog.count({
      where: { consentType: "MARKETING", accepted: true, withdrawnAt: null, createdAt: { gte: since30 } },
    }),
    prisma.lead.count({ where: { marketingOptedOutAt: { gte: since30 } } }),
    prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: since30 } },
      select: { eventName: true, source: true, page: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    }),
    prisma.order.aggregate({
      where: { status: "PAID", paidAt: { gte: since30 } },
      _sum: { totalAmount: true },
    }),
  ]);

  const leadCount30 = leads30.length;
  const sources = topRows(leads30.map((lead) => lead.source || utmValue(lead.utm, "utm_source")));
  const campaigns = topRows(leads30.map((lead) => utmValue(lead.utm, "utm_campaign")), "Unlabelled campaign");
  const landingViews = events30.filter((event) => event.eventName === "LandingPageView").length;
  const quickApplyViews = events30.filter((event) => event.page?.includes("/apply/quick")).length;
  const revenue = Number(revenue30._sum.totalAmount ?? 0);

  const metaPixel = Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID);
  const metaCapi = Boolean(process.env.META_CAPI_ACCESS_TOKEN);
  const instagram = process.env.NEXT_PUBLIC_INSTAGRAM_URL || "";

  return (
    <AdminShell
      title="Marketing Control Room"
      description="One secure view for acquisition, campaign attribution, consent health and conversion performance."
      adminName={admin.fullName}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={UsersRound} label="New leads · 30 days" value={String(leadCount30)} note={`${leads7} in the last 7 days`} />
        <Metric icon={ShieldCheck} label="OTP verified" value={String(verified30)} note={`${percent(verified30, leadCount30)}% of new leads`} />
        <Metric icon={Target} label="Assessments completed" value={String(assessments30)} note={`${percent(assessments30, leadCount30)}% lead-to-assessment`} />
        <Metric icon={Activity} label="Paid conversions" value={String(paid30)} note={`₹${revenue.toLocaleString("en-IN")} captured · 30 days`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-2xl border border-line bg-white p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Acquisition funnel</p>
              <h2 className="mt-2 text-xl font-bold text-navy-950">30-day customer journey</h2>
            </div>
            <p className="text-xs text-slate-500">Privacy-safe, first-party operational data</p>
          </div>
          <div className="mt-6 grid gap-3">
            <FunnelRow label="Landing page views" value={landingViews} max={Math.max(landingViews, leadCount30, 1)} />
            <FunnelRow label="Quick Apply page activity" value={quickApplyViews} max={Math.max(landingViews, quickApplyViews, 1)} />
            <FunnelRow label="Leads created" value={leadCount30} max={Math.max(landingViews, leadCount30, 1)} />
            <FunnelRow label="OTP verified" value={verified30} max={Math.max(landingViews, leadCount30, 1)} />
            <FunnelRow label="Assessment completed" value={assessments30} max={Math.max(landingViews, leadCount30, 1)} />
            <FunnelRow label="Paid" value={paid30} max={Math.max(landingViews, leadCount30, 1)} />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-navy-950 p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-300">Connection health</p>
          <h2 className="mt-2 text-xl font-bold">Marketing stack</h2>
          <div className="mt-5 grid gap-3">
            <Status label="Instagram profile" ok={Boolean(instagram)} detail={instagram ? "Connected to website CTA" : "Production URL missing"} icon={Instagram} />
            <Status label="Meta Pixel" ok={metaPixel} detail={metaPixel ? "Configured · consent gated" : "Pixel ID missing"} icon={MousePointerClick} />
            <Status label="Conversions API" ok={metaCapi} detail={metaCapi ? "Token present · delivery must stay verified" : "Server token missing"} icon={Activity} />
            <Status label="Marketing consent" ok={consented30 > 0} detail={`${consented30} accepted · ${optedOut30} opted out (30d)`} icon={ShieldCheck} />
          </div>
          <p className="mt-5 rounded-xl bg-white/8 p-3 text-xs leading-5 text-slate-300">
            Promotional outreach must use only leads with active marketing consent. Never export or upload personal data to ad platforms without an approved purpose.
          </p>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Ranking title="Top lead sources" subtitle="Lead.source or utm_source · last 30 days" rows={sources} total={leadCount30} />
        <Ranking title="Top campaigns" subtitle="utm_campaign · last 30 days" rows={campaigns} total={leadCount30} />
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700"><Megaphone size={20} /></span>
          <div>
            <h2 className="font-bold text-navy-950">Solo marketing workflow</h2>
            <p className="text-sm text-slate-500">A repeatable weekly operating rhythm for one owner.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Action number="01" title="Plan" text="Choose one audience, one offer and one primary CTA: Quick Apply." />
          <Action number="02" title="Publish" text="Use tagged links for Instagram bio, stories, reels and partner posts." />
          <Action number="03" title="Measure" text="Review sources, funnel drop-offs, paid conversions and consent health here." />
          <Action number="04" title="Improve" text="Scale the best campaign; fix the weakest conversion step before adding spend." />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/apply/quick?utm_source=instagram&utm_medium=organic&utm_campaign=profile_check" className="inline-flex items-center gap-2 rounded-xl bg-navy-950 px-4 py-2.5 text-sm font-bold text-white">
            Test Instagram campaign link <ArrowUpRight size={16} />
          </Link>
          {instagram ? <a href={instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-navy-900">Open Instagram <ArrowUpRight size={16} /></a> : null}
          <Link href="/admin/leads" className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-navy-900">Open Lead CRM <ArrowUpRight size={16} /></Link>
        </div>
      </section>
    </AdminShell>
  );
}

function Metric({ icon: Icon, label, value, note }: { icon: typeof Activity; label: string; value: string; note: string }) {
  return <div className="rounded-2xl border border-line bg-white p-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">{label}</p><Icon size={18} className="text-brand-700" /></div><p className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-navy-950">{value}</p><p className="mt-2 text-xs text-slate-500">{note}</p></div>;
}

function FunnelRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.max(value > 0 ? 6 : 0, Math.round((value / max) * 100));
  return <div><div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-semibold text-slate-700">{label}</span><span className="font-bold text-navy-950">{value}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-brand-600" style={{ width: `${width}%` }} /></div></div>;
}

function Status({ label, ok, detail, icon: Icon }: { label: string; ok: boolean; detail: string; icon: typeof Activity }) {
  return <div className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3"><Icon size={18} className="mt-0.5 text-brand-300" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">{label}</p>{ok ? <CheckCircle2 size={16} className="text-emerald-400" /> : <CircleAlert size={16} className="text-amber-400" />}</div><p className="mt-1 text-xs leading-5 text-slate-300">{detail}</p></div></div>;
}

function Ranking({ title, subtitle, rows, total }: { title: string; subtitle: string; rows: Array<{ label: string; count: number }>; total: number }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <h2 className="font-bold text-navy-950">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      <div className="mt-5 grid gap-3">
        {rows.length ? rows.map((row, index) => {
          const share = percent(row.count, total);
          return (
            <div key={row.label} className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-xs font-bold text-navy-950">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate font-semibold text-slate-700">{row.label}</span>
                  <span className="font-bold text-navy-950">{row.count}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${share}%` }} />
                </div>
              </div>
            </div>
          );
        }) : <p className="text-sm text-slate-500">No campaign data yet.</p>}
      </div>
    </section>
  );
}

function Action({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="rounded-xl border border-line bg-surface/60 p-4"><p className="text-xs font-extrabold text-brand-700">{number}</p><h3 className="mt-2 font-bold text-navy-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>;
}
