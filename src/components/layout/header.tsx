"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";

const links = [
  ["Loan Categories", "/#loan-options"],
  ["How it works", "/#how-it-works"],
  ["Benefits", "/#benefits"],
  ["FAQ", "/#faq"],
];

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-white/90 backdrop-blur-xl">
      <div className="page-shell flex min-h-20 items-center justify-between gap-4 py-3">
        <Link href="/" className="flex items-center gap-2.5" aria-label="VP Loan Connect home">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-navy-950 text-sm font-black tracking-[-0.08em] text-brand-500 shadow-[0_8px_24px_rgba(6,21,33,0.18)]">VP</span>
          <span className="leading-tight"><span className="block text-sm font-extrabold tracking-[-0.025em] text-navy-950">VP Loan Connect</span><span className="hidden text-[10px] font-semibold tracking-wide text-slate-500 sm:block">SMART LOAN READINESS</span></span>
        </Link>
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
          {links.map(([label, href]) => <Link key={href} href={href} className="text-sm font-semibold text-slate-600 transition hover:text-brand-700">{label}</Link>)}
        </nav>
        <div className="hidden sm:block"><ButtonLink href="/assessment" size="sm">Check My Eligibility <ArrowRight size={16} /></ButtonLink></div>
        <button type="button" className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-white text-navy-950 lg:hidden" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
      {open ? (
        <div className="border-t border-line bg-white lg:hidden">
          <nav className="page-shell grid gap-1 py-4" aria-label="Mobile navigation">
            {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3.5 text-sm font-semibold text-navy-900 hover:bg-surface">{label}</Link>)}
            <ButtonLink href="/assessment" className="mt-2 w-full">Check My Eligibility <ArrowRight size={16} /></ButtonLink>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
