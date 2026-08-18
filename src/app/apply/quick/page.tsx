import type { Metadata } from "next";
import { Suspense } from "react";
import { QuickApplyClient } from "@/components/apply/quick-apply-client";

export const metadata: Metadata = {
  title: "Quick Apply — Check loan options for your profile",
  description:
    "Verify email, answer a few profile questions, unlock the ₹99 + GST Credit Profile Booster, then view matched loan options. Not a lender approval.",
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
