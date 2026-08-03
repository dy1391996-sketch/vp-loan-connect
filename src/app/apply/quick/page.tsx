import type { Metadata } from "next";
import { Suspense } from "react";
import { QuickApplyClient } from "@/components/apply/quick-apply-client";

export const metadata: Metadata = {
  title: "Quick Apply — Profile check & matched options",
  description:
    "Mobile-first Quick Apply for VP Loan Connect. Complete a preliminary profile check, verify email, and unlock matched lender options with a transparent ₹99 + GST fee.",
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
