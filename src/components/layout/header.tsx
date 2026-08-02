"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";

const links = [
  ["Personal Loan", "/personal-loan"],
  ["₹99 Booster", "/credit-health"],
  ["How it works", "/#how-it-works"],
  ["FAQ", "/#faq"],
];

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-2xl">
      <div className="page-shell flex min-h-[4.75rem] items-center justify-between gap-4 py-3">
        <Link href="/" className="flex items-center gap-3" aria-label="VP Loan Connect home">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-navy-950 font-display text-sm font-black tracking-[-0.08em] text-brand-500">
            VP
          </span>
          <span className="leading-tight">
            <span className="font-display block text-[15px] font-extrabold tracking-[-0.03em] text-navy-950">VP Loan Connect</span>
            <span className="hidden text-[10px] font-semibold tracking-[0.14em] text-slate-500 sm:block">CREDIT PROFILE · LOAN MATCHING</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="text-sm font-semibold text-slate-600 transition hover:text-brand-700">
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden sm:block">
          <ButtonLink href="/assessment" size="sm" variant="dark">
            Free Profile Check <ArrowRight size={16} />
          </ButtonLink>
        </div>
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-white text-navy-950 lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-line bg-white lg:hidden">
          <nav className="page-shell grid gap-1 py-4" aria-label="Mobile navigation">
            {links.map(([label, href]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3.5 text-sm font-semibold text-navy-900 hover:bg-surface">
                {label}
              </Link>
            ))}
            <ButtonLink href="/assessment" className="mt-2 w-full" variant="dark">
              Free Profile Check <ArrowRight size={16} />
            </ButtonLink>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
