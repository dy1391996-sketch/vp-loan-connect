import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Apply — Start your Credit Profile",
  description:
    "Verify email, unlock the ₹116.82 Credit Profile Booster, then complete your detailed profile. Not a lender approval.",
  alternates: { canonical: "/apply/quick" },
};

export default async function AssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string; purpose?: string; loanType?: string }>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  if (query.amount) params.set("amount", query.amount);
  if (query.purpose) params.set("purpose", query.purpose);
  redirect(`/apply/quick${params.toString() ? `?${params.toString()}` : ""}`);
}
