import { ArrowUpRight, Landmark, LockKeyhole, Sparkles } from "lucide-react";
import { PartnerHandoffLink } from "@/components/partner-handoff-link";
import type { MatchedOption } from "@/lib/matching/match-service";

type Props = {
  matched: MatchedOption[];
  more: MatchedOption[];
  tone?: "dark" | "light";
};

export function ConnectOptionsPanel({ matched, more, tone = "dark" }: Props) {
  const dark = tone === "dark";

  return (
    <div className={dark ? "rounded-[2.25rem] bg-navy-950 p-7 text-white shadow-card sm:p-10" : "rounded-[2.25rem] border border-line bg-white p-7 shadow-soft sm:p-10"}>
      <div className="flex items-start gap-4">
        <span className={dark ? "grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-500/15 text-brand-500" : "grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700"}>
          <Landmark size={23} />
        </span>
        <div>
          <p className={dark ? "text-xs font-extrabold uppercase tracking-[0.18em] text-brand-500" : "text-xs font-extrabold uppercase tracking-[0.18em] text-brand-700"}>
            Payment unlocked · Loan connect links
          </p>
          <h2 className={dark ? "mt-3 font-display text-3xl font-black tracking-[-0.04em]" : "mt-3 font-display text-3xl font-black tracking-[-0.04em] text-navy-950"}>
            Official platforms you can connect to
          </h2>
          <p className={dark ? "mt-3 max-w-3xl text-sm leading-7 text-slate-300" : "mt-3 max-w-3xl text-sm leading-7 text-slate-600"}>
            Best-fit options appear first, followed by additional official loan links. We never auto-submit your data; each lender decides the amount, APR, fees and approval.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {matched.map((option) => (
          <OptionCard key={option.id} option={option} dark={dark} />
        ))}
      </div>

      {more.length ? (
        <div className="mt-10">
          <h3 className={dark ? "font-display text-xl font-extrabold" : "font-display text-xl font-extrabold text-navy-950"}>
            More platforms you can also open
          </h3>
          <p className={dark ? "mt-2 text-sm text-slate-400" : "mt-2 text-sm text-slate-600"}>
            Additional official links — each platform performs its own eligibility assessment.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((option) => (
              <PartnerHandoffLink
                key={option.id}
                href={option.href}
                name={option.name}
                className={dark
                  ? "rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:border-brand-500/40"
                  : "rounded-2xl border border-line bg-surface px-4 py-4 transition hover:border-brand-500/40"}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={dark ? "font-extrabold text-white" : "font-extrabold text-navy-950"}>{option.name}</p>
                    <p className={dark ? "mt-1 text-xs text-slate-400" : "mt-1 text-xs text-slate-500"}>{option.productName}</p>
                  </div>
                  <ArrowUpRight className="shrink-0 text-brand-500" size={18} />
                </div>
              </PartnerHandoffLink>
            ))}
          </div>
        </div>
      ) : null}

      <div className={dark ? "mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-xs leading-6 text-slate-300" : "mt-6 flex items-start gap-3 rounded-2xl border border-line bg-surface p-5 text-xs leading-6 text-slate-600"}>
        <LockKeyhole className="mt-0.5 shrink-0 text-brand-500" size={17} />
        Avoid submitting many applications at once because each application may create a credit enquiry. Review the Key Fact Statement, APR and total charges before proceeding.
      </div>
    </div>
  );
}

function OptionCard({ option, dark }: { option: MatchedOption; dark: boolean }) {
  return (
    <PartnerHandoffLink
      href={option.href}
      name={option.name}
      className={dark
        ? "group rounded-3xl border border-white/10 bg-white/8 p-6 transition hover:-translate-y-0.5 hover:border-brand-500/50"
        : "group rounded-3xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-brand-500/40"}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.15em] text-brand-500">
          {option.fitLabel === "Best profile fit" ? <><Sparkles size={15} />{option.fitLabel}</> : option.fitLabel}
          <span className={dark ? "rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200" : "rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500"}>
            Fit {option.fitScore}
          </span>
        </span>
        <ArrowUpRight className={dark ? "text-slate-400 transition group-hover:text-brand-500" : "text-slate-400 transition group-hover:text-brand-700"} size={20} />
      </div>
      <h3 className={dark ? "mt-5 text-xl font-extrabold" : "mt-5 text-xl font-extrabold text-navy-950"}>{option.name}</h3>
      <p className={dark ? "mt-1 text-xs font-semibold text-slate-400" : "mt-1 text-xs font-semibold text-slate-500"}>
        {option.productName} · {option.category}
      </p>
      <p className={dark ? "mt-2 text-sm leading-6 text-slate-300" : "mt-2 text-sm leading-6 text-slate-600"}>{option.description}</p>
      <p className="mt-4 text-xs font-bold text-brand-500">Connect on official platform</p>
    </PartnerHandoffLink>
  );
}
