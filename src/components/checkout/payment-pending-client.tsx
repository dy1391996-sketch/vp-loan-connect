"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

type Props = {
  orderReference: string;
  resultToken?: string;
  assessmentId?: string;
};

const MAX_POLLS = 8;

export function PaymentPendingClient({ orderReference, resultToken, assessmentId }: Props) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [statusLabel, setStatusLabel] = useState("Checking payment status…");
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!resultToken || done) return;
    let cancelled = false;
    let delay = 1500;

    async function poll(count: number) {
      if (cancelled || count >= MAX_POLLS) {
        setDone(true);
        setStatusLabel("Still confirming with the payment provider. You can refresh this page later — do not pay again.");
        return;
      }
      setAttempts(count + 1);
      try {
        const response = await fetch("/api/payments/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({ order: orderReference, token: resultToken }),
        });
        const data = (await response.json()) as {
          status?: string;
          reportId?: string;
          reportToken?: string;
          orderReference?: string;
        };
        if (response.ok && data.status === "paid" && data.reportId && data.reportToken) {
          router.replace(
            `/payment/success?order=${encodeURIComponent(data.orderReference || orderReference)}&report=${data.reportId}&token=${encodeURIComponent(data.reportToken)}`,
          );
          return;
        }
        if (response.ok && data.status === "failed") {
          router.replace(
            `/payment/failed?assessment=${assessmentId || ""}&reason=${encodeURIComponent("Payment was not completed")}`,
          );
          return;
        }
        setStatusLabel(`Verification still in progress (check ${count + 1} of ${MAX_POLLS})…`);
      } catch {
        setStatusLabel("Temporary network issue while checking status. Retrying…");
      }
      delay = Math.min(delay * 1.6, 12_000);
      timerRef.current = setTimeout(() => void poll(count + 1), delay);
    }

    void poll(0);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [assessmentId, done, orderReference, resultToken, router]);

  return (
    <div className="mt-7 space-y-4">
      <p className="flex items-center justify-center gap-2 text-sm font-semibold text-navy-950" aria-live="polite">
        {!done ? <Loader2 className="animate-spin text-brand-700" size={18} /> : null}
        {statusLabel}
      </p>
      {!resultToken ? (
        <p className="text-xs leading-6 text-slate-500">
          Automatic status checks need the checkout access token. Keep this page open if you were redirected from payment, or
          contact support with order {orderReference}.
        </p>
      ) : null}
      {done || attempts >= MAX_POLLS ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <ButtonLink href="/contact" variant="secondary" size="md">
            Contact support
          </ButtonLink>
          <ButtonLink href={assessmentId ? `/result/${assessmentId}` : "/assessment"} size="md">
            Back to assessment
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
