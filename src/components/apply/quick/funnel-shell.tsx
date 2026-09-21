import { Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { FUNNEL_PROGRESS_LABELS, progressIndexForScreen } from "@/lib/apply/funnel-route";
import { cn } from "@/lib/utils";

const TRUST_ITEMS = [
  "Secure email verification",
  "Transparent ₹116.82 pricing",
  "No guaranteed approvals",
  "Official lender apply links",
  "Privacy-first process",
];

const NEXT_STEPS = [
  "Tell us your loan requirement",
  "Verify your email",
  "Unlock Loan Matches — ₹116.82",
  "Complete your profile",
  "View matched options",
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
  const progress = phase === "result" ? FUNNEL_PROGRESS_LABELS.length : progressIndexForScreen(step);
  const pct = Math.round((progress / FUNNEL_PROGRESS_LABELS.length) * 100);
  const label = phase === "result" ? "Results" : FUNNEL_PROGRESS_LABELS[progress - 1];

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-navy-950 font-display text-sm font-black tracking-[-0.08em] text-white">
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
          <p className="text-xs font-extrabold text-navy-950">
            Step {progress} of {FUNNEL_PROGRESS_LABELS.length}
          </p>
          <p className="text-[11px] font-semibold text-slate-500">
            {label} · {saved ? "Progress saved" : "Saving…"}
          </p>
        </div>
      </div>
      <ol className="mx-auto flex min-w-0 max-w-full gap-2 overflow-x-auto px-4 pb-3 sm:px-6" aria-label="Application progress">
        {FUNNEL_PROGRESS_LABELS.map((item, index) => {
          const n = index + 1;
          const done = progress > n;
          const active = progress === n;
          return (
            <li
              key={item}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold",
                active ? "border-brand-600 bg-brand-600 text-white" : done ? "border-brand-100 bg-brand-100 text-brand-700" : "border-line bg-white text-slate-500",
              )}
            >
              <span className="grid h-4 w-4 place-items-center rounded-full bg-white/20 text-[10px]">{done ? <Check size={10} /> : n}</span>
              {item}
            </li>
          );
        })}
      </ol>
      <div className="h-1.5 w-full bg-line" aria-hidden="true">
        <div className="h-full bg-brand-600 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </header>
  );
}

export function FunnelSidebar({ step }: { step: number }) {
  const progress = progressIndexForScreen(step);
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-36 space-y-4">
        <div className="rounded-[1.75rem] border border-line bg-white p-6 shadow-soft">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">What happens next</p>
          <ul className="mt-4 space-y-3">
            {NEXT_STEPS.map((item, index) => {
              const n = index + 1;
              const done = progress > n;
              const active = progress === n;
              return (
                <li key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                  <span
                    className={cn(
                      "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold",
                      done || active ? "bg-brand-600 text-white" : "bg-line text-slate-500",
                    )}
                  >
                    {done ? <Check size={12} /> : n}
                  </span>
                  <span className={cn(active ? "font-bold text-navy-950" : "")}>{item}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-[1.75rem] border border-line bg-navy-950 p-6 text-white shadow-soft">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-brand-500">
            <ShieldCheck size={14} /> Trust
          </p>
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
    <div className="mt-4 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Trust indicators">
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
    <div className="sticky bottom-0 z-30 -mx-5 mt-8 border-t border-line bg-white/95 px-5 py-3 backdrop-blur-xl sm:-mx-8 sm:px-8">
      {error ? (
        <p className="mb-2 text-sm font-semibold text-red-700" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">{children}</div>
    </div>
  );
}
