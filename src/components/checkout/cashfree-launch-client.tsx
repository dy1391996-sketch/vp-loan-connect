"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusNotice } from "@/components/ui/status-notice";
import { createCashfreeSdk } from "@/lib/payments/cashfree-browser";

declare global {
  interface Window {
    Cashfree?: Parameters<typeof createCashfreeSdk>[0];
  }
}

type Props = {
  paymentSessionId: string;
  env: "sandbox" | "production";
  internalOrderId: string;
  assessmentId: string;
  productSlug: string;
  resultToken: string;
  orderReference: string;
};

const LAUNCH_TIMEOUT_MS = 12_000;

export function CashfreeLaunchClient(props: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const launched = useRef(false);

  useEffect(() => {
    if (launched.current) return;
    launched.current = true;

    let cancelled = false;
    let timeoutId: number | undefined;

    async function openHostedCheckout() {
      try {
        await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js", () => Boolean(window.Cashfree));
        if (cancelled) return;
        if (!window.Cashfree) throw new Error("Secure payment page could not be loaded. Disable blockers and try again.");

        const cashfree = createCashfreeSdk(window.Cashfree, props.env);
        timeoutId = window.setTimeout(() => {
          if (cancelled || document.visibilityState !== "visible") return;
          setError("Payment page did not open. Retry this payment.");
        }, LAUNCH_TIMEOUT_MS);

        await cashfree.checkout({
          paymentSessionId: props.paymentSessionId,
          redirectTarget: "_top",
        });

        // Redirect checkout may resolve while navigation is still in progress.
        window.setTimeout(() => {
          if (cancelled || document.visibilityState !== "visible") return;
          setError("Payment page did not open. Retry this payment.");
        }, 2500);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Payment page could not be opened.");
      }
    }

    void openHostedCheckout();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [props.env, props.paymentSessionId]);

  function backToCheckout() {
    const params = new URLSearchParams({
      product: props.productSlug,
      assessment: props.assessmentId,
      token: props.resultToken,
    });
    router.replace(`/checkout?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-lg rounded-[2rem] border border-line/80 bg-white p-8 text-center shadow-soft sm:p-10">
      {error ? (
        <>
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-700">
            <CircleAlert size={26} />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold tracking-[-0.04em] text-navy-950">Payment not completed — Try again</h1>
          <div className="mt-5" aria-live="polite">
            <StatusNotice tone="error">{error}</StatusNotice>
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-500">Payment reference: {props.orderReference}</p>
          <Button size="lg" className="mt-6 w-full" onClick={backToCheckout}>
            Back to secure payment
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="mx-auto animate-spin text-brand-700" size={34} />
          <h1 className="mt-6 text-2xl font-extrabold tracking-[-0.04em] text-navy-950">Preparing secure payment…</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Redirecting you to Cashfree&apos;s hosted payment page for ₹116.82. Do not close this tab until payment completes.
          </p>
          <p className="mt-4 text-xs font-semibold text-slate-500">Payment reference: {props.orderReference}</p>
        </>
      )}
    </div>
  );
}

async function loadScript(src: string, ready: () => boolean) {
  if (ready()) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(new Error("Payment checkout could not be loaded."));
    };

    if (existing) {
      if (ready()) {
        done();
        return;
      }
      existing.addEventListener("load", () => done(), { once: true });
      existing.addEventListener("error", () => fail(), { once: true });
      window.setTimeout(() => (ready() ? done() : fail()), 10_000);
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => done();
    script.onerror = () => fail();
    document.head.appendChild(script);
    window.setTimeout(() => (ready() ? done() : fail()), 10_000);
  });
}
