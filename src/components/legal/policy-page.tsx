import Link from "next/link";
import { ArrowUpRight, CalendarDays, Check, ShieldCheck } from "lucide-react";

export type PolicySection = { title: string; paragraphs?: string[]; bullets?: string[] };

export function PolicyPage({
  title,
  summary,
  sections,
  updated = "23 July 2026",
}: {
  title: string;
  summary: string;
  sections: PolicySection[];
  updated?: string;
}) {
  return (
    <section className="surface-grid bg-surface py-12 sm:py-18">
      <div className="page-shell">
        <article className="mx-auto max-w-5xl">
          <header className="relative overflow-hidden rounded-[2rem] bg-navy-950 p-7 text-white shadow-soft sm:p-10 lg:p-12">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
            <div className="relative max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-4 py-2 text-xs font-bold text-brand-100">
                <ShieldCheck size={15} aria-hidden="true" /> Legal & policy
              </span>
              <h1 className="mt-6 text-balance text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl">{title}</h1>
              <p className="mt-5 text-base leading-8 text-slate-300">{summary}</p>
              <p className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-400">
                <CalendarDays size={15} aria-hidden="true" /> Effective {updated}
              </p>
            </div>
          </header>

          <div className="mt-6 grid gap-4">
            {sections.map((section, index) => (
              <section key={section.title} className="rounded-3xl border border-line/80 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-col items-start gap-4 sm:flex-row">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-xs font-black text-brand-700">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-extrabold tracking-[-0.025em] text-navy-950">{section.title}</h2>
                    {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-4 text-sm leading-7 text-slate-600">{paragraph}</p>)}
                    {section.bullets ? (
                      <ul className="mt-4 grid gap-3">
                        {section.bullets.map((item) => (
                          <li key={item} className="flex items-start gap-3 text-sm leading-7 text-slate-600">
                            <span className="mt-1.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700"><Check size={12} strokeWidth={3} /></span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </section>
            ))}
          </div>

          <footer className="mt-6 flex flex-col gap-4 rounded-3xl border border-line bg-white p-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>Need clarification about this policy?</p>
            <Link href="/contact" className="inline-flex min-h-11 items-center gap-2 font-extrabold text-brand-700 transition hover:text-brand-600">
              Contact Support Team <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </footer>
        </article>
      </div>
    </section>
  );
}
