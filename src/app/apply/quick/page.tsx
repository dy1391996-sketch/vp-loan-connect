import type { Metadata } from "next";
import { Suspense } from "react";
import { QuickApplyClient } from "@/components/apply/quick-apply-client";

export const metadata: Metadata = {
  title: "Start Your Credit Profile — VP Loan Connect",
  description:
    "Verify email, unlock the ₹116.82 Credit Profile Booster, then complete your detailed profile. Not a lender approval.",
  alternates: { canonical: "/apply/quick" },
  openGraph: {
    title: "Quick Apply | VP Loan Connect",
    description: "Preliminary loan profile check with secure email verification. Not a lender approval.",
    url: "/apply/quick",
  },
};

export default function QuickApplyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen animate-pulse bg-surface" />}>
      <QuickApplyClient />
    </Suspense>
  );
}
