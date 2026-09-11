import { CircleAlert, FileText, LockKeyhole, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CREDIT_REPORT_DISCLAIMER, PAYMENT_DESCRIPTION, PLATFORM_DISCLAIMER } from "@/lib/constants";

type Props = {
  kind: "credit" | "readiness";
  title: string;
  heading: string;
  description: string;
  regular?: string;
  price: string;
  total: string;
  badge: string;
  deliverables: string[];
};

export function ProductPage({ kind, title, heading, description, regular, price, total, badge, deliverables }: Props) {
  return (
    <>
      <section className="hero-premium relative overflow-hidden py-20 text-white sm:py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="animate-pulse-soft absolute -right-20 top-8 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
        </div>
        <div className="page-shell relative grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-rise">
            <p className="font-display text-sm font-extrabold tracking-[0.28em] text-brand-500">VP LOAN CONNECT</p>
            <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">{badge}</p>
            <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-500">{title}</p>
            <h1 className="font-display mt-4 text-balance text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl lg:text-[3.5rem]">
              {heading}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{description}</p>
            <ButtonLink href="/assessment" size="lg" className="mt-9">
              Start With Free Profile Check
            </ButtonLink>
          </div>

          <div className="animate-rise-delay relative mx-auto w-full max-w-md">
            <div className="animate-pulse-soft absolute -inset-8 rounded-full bg-brand-500/15 blur-3xl" />
            <div className="premium-panel relative overflow-hidden rounded-[2rem] p-3">
              <div className="rounded-[1.6rem] bg-white p-7 text-navy-950 sm:p-9">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                    <FileText size={24} />
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-navy-950 px-3 py-1.5 text-[11px] font-bold text-brand-500">
                    <Sparkles size={13} />
                    Launch offer
                  </span>
                </div>
                {regular ? <p className="mt-7 text-sm text-slate-500 line-through">Regular {regular}</p> : null}
                <p className={`font-display text-3xl font-black tracking-[-0.045em] sm:text-4xl ${regular ? "mt-1" : "mt-7"}`}>{price}</p>
                <p className="mt-2 text-sm font-bold text-brand-700">{total}</p>
                <div className="mt-7 flex gap-3 rounded-2xl bg-surface p-4 text-xs leading-6 text-slate-600">
                  <LockKeyhole className="shrink-0 text-brand-700" size={17} />
                  Price appears after the free preview and covers assessment/report services only.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-space bg-white">
        <div className="page-shell grid gap-12 lg:grid-cols-[0.68fr_1.32fr]">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-700">What you receive</p>
            <h2 className="font-display mt-4 text-3xl font-extrabold tracking-[-0.045em] text-navy-950 sm:text-4xl">
              Personalized, practical and downloadable
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">The report is based on your assessment inputs. It is not a generic approval certificate.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {deliverables.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-2xl bg-surface p-5 text-sm font-semibold leading-6 text-navy-900">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-black text-brand-700">
                  {index + 1}
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-grid bg-surface py-16">
        <div className="page-shell grid gap-5 lg:grid-cols-2">
          <div className="rounded-[1.5rem] border border-line bg-white p-7 shadow-sm">
            <ShieldCheck className="text-brand-700" />
            <h2 className="font-display mt-5 text-xl font-extrabold text-navy-950">Payment purpose</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{PAYMENT_DESCRIPTION}</p>
          </div>
          <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-7">
            <CircleAlert className="text-amber-700" />
            <h2 className="font-display mt-5 text-xl font-extrabold text-amber-950">Important boundary</h2>
            <p className="mt-3 text-sm leading-7 text-amber-950">{kind === "credit" ? CREDIT_REPORT_DISCLAIMER : PLATFORM_DISCLAIMER}</p>
          </div>
        </div>
      </section>

      <section className="section-space bg-white">
        <div className="page-shell">
          <div className="relative overflow-hidden rounded-[2rem] bg-navy-950 px-8 py-12 text-center text-white sm:px-12">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl" />
            <MessageCircle className="relative mx-auto text-brand-500" size={30} />
            <h2 className="font-display relative mt-5 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              View your free profile preview first
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-300">
              Choose an optional paid report only after your free result. There is no loan approval or score-increase guarantee.
            </p>
            <ButtonLink href="/assessment" size="lg" className="relative mt-8">
              Start Free Assessment
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
