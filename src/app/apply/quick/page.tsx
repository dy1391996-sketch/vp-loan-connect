import type { Metadata } from "next";
import { Suspense } from "react";
import { QuickApplyClient } from "@/components/apply/quick-apply-client";
import { PLATFORM_DISCLAIMER, USP_PRICE_LABEL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Quick Apply — Amount, verify, unlock matches",
  description:
    `Choose amount and purpose, verify with OTP, complete eligibility and address, then unlock official partner links with the ${USP_PRICE_LABEL} Credit Profile Booster.`,
  alternates: { canonical: "/apply/quick" },
  openGraph: {
    title: "Quick Apply | VP Loan Connect",
    description: "Meta-ad friendly quick apply. Smooth 4-step profile. Honest ₹99 unlocks official partner links.",
    url: "/apply/quick",
  },
};

export default function QuickApplyPage() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-surface">
      <div className="hero-premium relative overflow-hidden text-white">
        <div className="page-shell relative py-12 sm:py-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-display text-sm font-extrabold tracking-[0.28em] text-brand-500">VP LOAN CONNECT</p>
            <h1 className="font-display mt-4 text-balance text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl">
              How much do you need?
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Pick amount → verify OTP → eligibility & address → unlock official partner links for honest {USP_PRICE_LABEL} + GST. No ~10% platform fee.
            </p>
          </div>
        </div>
      </div>

      <div className="page-shell relative z-10 -mt-6 pb-16">
        <Suspense fallback={<div className="mx-auto h-[520px] max-w-xl animate-pulse rounded-[1.75rem] bg-white shadow-soft" />}>
          <QuickApplyClient />
        </Suspense>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-6 text-slate-500">{PLATFORM_DISCLAIMER}</p>
      </div>
    </section>
  );
}
