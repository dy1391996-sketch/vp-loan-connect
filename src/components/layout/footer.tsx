"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { InstagramDirectLink } from "@/components/instagram-direct-link";
import { PLATFORM_DISCLAIMER, PUBLIC_SUPPORT_EMAIL, TAGLINE } from "@/lib/constants";

const legal = [
  ["Privacy Policy", "/privacy"],
  ["Terms & Conditions", "/terms"],
  ["Refund Policy", "/refund-policy"],
  ["Disclaimer", "/disclaimer"],
  ["Consent Policy", "/consent-policy"],
  ["Data deletion", "/data-deletion"],
];

export function Footer() {
  const [instagramUrl, setInstagramUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public-config", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { instagramUrl?: string } | null) => {
        if (cancelled) return;
        const href = typeof data?.instagramUrl === "string" ? data.instagramUrl : "";
        setInstagramUrl(href);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="relative overflow-hidden bg-navy-950 text-white">
      <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="page-shell relative grid gap-12 py-16 md:grid-cols-2 xl:grid-cols-[1.35fr_0.65fr_0.8fr_0.8fr]">
        <div className="max-w-xl">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500 font-display text-sm font-black tracking-[-0.08em] text-navy-950">
              VP
            </span>
            <div>
              <p className="font-display font-extrabold tracking-[-0.02em]">VP Loan Connect</p>
              <p className="text-xs tracking-[0.08em] text-slate-400">{TAGLINE}</p>
            </div>
          </div>
          <p className="mt-6 text-sm leading-7 text-slate-300">{PLATFORM_DISCLAIMER}</p>
        </div>
        <div>
          <p className="font-display font-bold">Explore</p>
          <div className="mt-4 grid gap-1">
            {[
              ["Quick apply", "/apply/quick"],
              ["Personal loan", "/personal-loan"],
              ["Free assessment", "/assessment"],
              ["Credit Profile Booster (₹99)", "/credit-health"],
              ["Full readiness report (₹299)", "/loan-readiness"],
              ["Refer & Earn", "/refer"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="inline-flex min-h-11 items-center text-sm text-slate-300 transition hover:text-white">
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="font-display font-bold">Policies</p>
          <div className="mt-4 grid gap-1">
            {legal.map(([label, href]) => (
              <Link key={href} href={href} className="inline-flex min-h-11 items-center text-sm text-slate-300 transition hover:text-white">
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="font-display font-bold">Support</p>
          <div className="mt-4 grid gap-1 text-sm text-slate-300">
            <Link href="/about" className="inline-flex min-h-11 items-center hover:text-white">
              About us
            </Link>
            <Link href="/contact" className="inline-flex min-h-11 items-center hover:text-white">
              Contact us
            </Link>
            <Link href="/contact#grievance" className="inline-flex min-h-11 items-center hover:text-white">
              Grievance contact
            </Link>
            <Link href="/apply/quick" className="inline-flex min-h-11 items-center hover:text-white">
              Quick Apply
            </Link>
            {instagramUrl ? (
              <InstagramDirectLink href={instagramUrl} className="flex min-h-11 items-center gap-2 hover:text-white" />
            ) : null}
            <a href={`mailto:${PUBLIC_SUPPORT_EMAIL}`} className="flex min-h-11 items-center gap-2 hover:text-white">
              <Mail size={15} />
              {PUBLIC_SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="page-shell flex flex-col gap-2 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} VP Loan Connect</p>
          <p>₹99 Credit Profile Booster • www.vploanconnect.in</p>
        </div>
      </div>
    </footer>
  );
}
