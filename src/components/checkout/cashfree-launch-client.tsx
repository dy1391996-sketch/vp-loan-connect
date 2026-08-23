"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusNotice } from "@/components/ui/status-notice";
import { trackEvent } from "@/lib/analytics-client";
import {
  cashfreeHostedCheckoutAction,
  createCashfreeSdk,
  isCashfreeCheckoutModalOpen,
  launchCashfreeCheckoutWithTimeout,
} from "@/lib/payments/cashfree-browser";

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

const DID_NOT_OPEN_MESSAGE = "Payment page did not open. Use Open secure payment below.";

export function CashfreeLaunchClient(props: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(true);
  const launched = useRef(false);
  const hostedAction = cashfreeHostedCheckoutAction(props.env);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setPreparing(false);
      setError("Payment not completed — Try again.");
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (launched.current) return;
    launched.current = true;
    trackEvent("cashfree_checkout_opened", { product: props.productSlug, stage: "launch" });

    let cancelled = false;
    let modalWatch: number | undefined;

    async function openHostedCheckout() {
      try {
        await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js", () => Boolean(window.Cashfree));
        if (cancelled) return;
        if (!window.Cashfree) {
          setPreparing(false);
          setError("Secure payment page could not be loaded. Disable blockers, then tap Open secure payment.");
          return;
        }

        const cashfree = createCashfreeSdk(window.Cashfree, props.env);
        const launch = await launchCashfreeCheckoutWithTimeout(cashfree, {
          paymentSessionId: props.paymentSessionId,
          redirectTarget: "_top",
        });
        if (cancelled) return;

        if (launch.kind === "navigating" || launch.kind === "redirecting") {
          return;
        }

        if (launch.kind === "modal_open") {
          modalWatch = window.setInterval(() => {
            if (isCashfreeCheckoutModalOpen()) return;
            if (modalWatch) window.clearInterval(modalWatch);
            setPreparing(false);
            setError("Payment not completed — Try again.");
          }, 700);
          return;
        }

        setPreparing(false);
        if (launch.kind === "error") {
          setError(
            launch.cancelled
              ? "Payment was cancelled before completion — Try again."
              : launch.message || DID_NOT_OPEN_MESSAGE,
          );
          return;
        }
        setError(DID_NOT_OPEN_MESSAGE);
      } catch (caught) {
        if (cancelled) return;
        setPreparing(false);
        setError(caught instanceof Error ? caught.message : DID_NOT_OPEN_MESSAGE);
      }
    }

    void openHostedCheckout();
    return () => {
      cancelled = true;
      if (modalWatch) window.clearInterval(modalWatch);
    };
  }, [props.env, props.paymentSessionId, props.productSlug]);

  function backToCheckout() {
    const params = new URLSearchParams({
      product: props.productSlug,
      assessment: props.assessmentId,
      token: props.resultToken,
    });
    router.replace(`/checkout?${params.toString()}`);
  }

  function onNativeSubmit() {
    trackEvent("cashfree_checkout_opened", { product: props.productSlug, stage: "native_form" });
  }

  return (
    <div className="mx-auto max-w-lg rounded-[2rem] border border-line/80 bg-white p-8 text-center shadow-soft sm:p-10">
      {preparing && !error ? (
        <Loader2 className="mx-auto animate-spin text-brand-700" size={34} />
      ) : (
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand-700">
          <LockKeyhole size={26} />
        </span>
      )}
      <h1 className="mt-6 text-2xl font-extrabold tracking-[-0.04em] text-navy-950">
        {error ? "Payment not completed — Try again" : "Continue to secure payment"}
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Cashfree hosted checkout for ₹116.82 opens in this tab. If it does not appear automatically, tap the button
        below — this uses a user-initiated form post, which mobile browsers allow.
      </p>
      {error ? (
        <div className="mt-5" aria-live="polite">
          <StatusNotice tone="error">{error}</StatusNotice>
        </div>
      ) : null}
      <p className="mt-4 text-xs font-semibold text-slate-500">Payment reference: {props.orderReference}</p>

      <form action={hostedAction} method="POST" target="_top" className="mt-6" onSubmit={onNativeSubmit}>
        <input type="hidden" name="payment_session_id" value={props.paymentSessionId} />
        <Button type="submit" size="lg" className="w-full">
          <LockKeyhole size={18} />
          Open secure payment — ₹116.82
        </Button>
      </form>

      {error ? (
        <Button type="button" size="lg" variant="secondary" className="mt-3 w-full" onClick={backToCheckout}>
          Back to checkout
        </Button>
      ) : (
        <p className="mt-4 text-xs leading-5 text-slate-500">Do not close this tab until Cashfree confirms payment.</p>
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
