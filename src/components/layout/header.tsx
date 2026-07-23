"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";

const links = [
  ["Loan Options", "/#loan-options"],
  ["How it works", "/#how-it-works"],
  ["Credit Health", "/credit-health"],
  ["Refer & Earn", "/refer"],
];

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-white/95 backdrop-blur">
      <div className="page-shell flex min-h-18 items-center justify-between gap-4 py-3">
        <Link href="/" className="flex items-center gap-2.5" aria-label="VP Loan Connect home">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-950 text-sm font-black tracking-[-0.08em] text-brand-500">VP</span>
          <span className="leading-tight"><span className="block text-sm font-extrabold tracking-[-0.02em] text-navy-950">VP Loan Connect</span><span className="hidden text-[10px] font-medium text-slate-500 sm:block">Smart profile check</span></span>
        </Link>
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
          {links.map(([label, href]) => <Link key={href} href={href} className="text-sm font-semibold text-slate-600 transition hover:text-brand-700">{label}</Link>)}
        </nav>
        <div className="hidden sm:block"><ButtonLink href="/assessment" size="sm">Free profile check</ButtonLink></div>
        <button type="button" className="grid h-11 w-11 place-items-center rounded-xl border border-line lg:hidden" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
      {open ? (
        <div className="border-t border-line bg-white lg:hidden">
          <nav className="page-shell grid gap-1 py-4" aria-label="Mobile navigation">
            {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-navy-900 hover:bg-surface">{label}</Link>)}
            <ButtonLink href="/assessment" className="mt-2 w-full">Free profile check</ButtonLink>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
