import { Check, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { QUICK_APPLY_STEP_LABELS, QUICK_APPLY_STEPS } from "@/lib/apply/quick-apply-state";
import { cn } from "@/lib/utils";

const TRUST_ITEMS = [
  "Secure email verification",
  "Privacy-first profile check",
  "No effect on CIBIL score",
  "Transparent ₹99 + GST fee",
  "Official lender links after unlock",
];

const NEXT_STEPS = [
  "Verify your email",
  "Unlock Credit Profile Booster",
  "Complete your detailed profile",
  "View matched loan options",
];

export function FunnelHeader({
  step,
  saved,
  phase,
}: {
  step: number;
  saved: boolean;
  phase: "form" | "payment" | "result";
}) {
  const pct =
    phase === "result"
      ? 100
      : phase === "payment"
        ? Math.round((5.5 / QUICK_APPLY_STEPS) * 100)
        : Math.round((Math.min(step, QUICK_APPLY_STEPS) / QUICK_APPLY_STEPS) * 100);
  const label =
    phase === "result"
      ? "Options ready"
      : phase === "payment"
        ? "Unlock matched options"
        : `Step ${step} of ${QUICK_APPLY_STEPS}`;

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-navy-950 font-display text-sm font-black tracking-[-0.08em] text-brand-500">
            VP
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-extrabold tracking-[-0.02em] text-navy-950">VP Loan Connect</p>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <LockKeyhole size={12} className="text-brand-700" />
              Secure application
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-extrabold text-navy-950">{label}</p>
          <p className="text-[11px] font-semibold text-slate-500">{saved ? "Progress saved" : "Saving…"} · {pct}%</p>
        </div>
      </div>
      <div className="h-1.5 w-full bg-line">
        <div className="h-full bg-brand-600 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </header>
  );
}

export function FunnelSidebar({ step }: { step: number }) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-28 space-y-4">
        <div className="rounded-[1.75rem] border border-line bg-white p-6 shadow-soft">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">
            <Sparkles size={14} /> Progress
          </p>
          <ol className="mt-5 space-y-3">
            {QUICK_APPLY_STEP_LABELS.map((label, index) => {
              const n = index + 1;
              const done = step > n;
              const active = step === n;
              return (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-full text-[11px] font-extrabold transition",
                      done || active ? "bg-brand-600 text-white" : "bg-line text-slate-500",
                    )}
                  >
                    {done ? <Check size={12} /> : n}
                  </span>
                  <span className={cn("font-semibold", active ? "text-navy-950" : "text-slate-500")}>{label}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rounded-[1.75rem] border border-line bg-white p-6 shadow-soft">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">
            <ShieldCheck size={14} /> What happens next
          </p>
          <ul className="mt-4 space-y-3">
            {NEXT_STEPS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                <Check className="mt-1 shrink-0 text-brand-600" size={14} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[1.75rem] border border-line bg-navy-950 p-6 text-white shadow-soft">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-500">Trust</p>
          <ul className="mt-4 space-y-3">
            {TRUST_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-300">
                <ShieldCheck className="mt-0.5 shrink-0 text-brand-500" size={14} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

export function MobileTrustStrip() {
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Trust indicators">
      {TRUST_ITEMS.map((item) => (
        <span key={item} className="shrink-0 rounded-full border border-line bg-white px-3 py-2 text-[11px] font-semibold text-slate-600">
          {item}
        </span>
      ))}
    </div>
  );
}

export function StickyActions({
  children,
  error,
}: {
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur-xl sm:-mx-0 sm:rounded-b-[1.75rem]">
      {error ? (
        <p className="mb-2 text-sm font-semibold text-red-700" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">{children}</div>
    </div>
  );
}
