import type { Metadata } from "next";
import { CashfreeLaunchClient } from "@/components/checkout/cashfree-launch-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Secure Cashfree Payment",
  robots: { index: false, follow: false },
};

export default function CashfreeLaunchPage() {
  return (
    <section className="surface-grid grid min-h-screen place-items-center bg-surface px-4 py-12">
      <CashfreeLaunchClient />
    </section>
  );
}
