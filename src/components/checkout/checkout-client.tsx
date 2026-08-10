"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Loader2, LockKeyhole, ReceiptText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusNotice } from "@/components/ui/status-notice";
import { PAYMENT_DESCRIPTION, PLATFORM_DISCLAIMER } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics-client";
import {
  REDIRECT_BLOCKED_MESSAGE,
  REDIRECT_WATCHDOG_MS,
  canStartPayment,
  checkoutButtonLabel,
  shouldRecoverFromBlockedRedirect,
} from "@/lib/payments/checkout-state";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: (response: { error?: { description?: string } }) => void) => void;
    };
  }
}

type CheckoutDescriptor =
  | { mode: "mock" }
  | { mode: "razorpay_modal"; keyId: string; orderId: string }
  | { mode: "cashfree_hosted"; actionUrl: string; fields: Record<string, string>; env: "sandbox" | "production" }
  | { mode: "phonepe_redirect"; redirectUrl: string }
  | { mode: "payu_hosted"; actionUrl: string; fields: Record<string, string> };

type CreateOrderResponse = {
  error?: string;
  provider?: string;
  keyConfigured?: boolean;
  missing?: string[];
  reused?: boolean;
  resumable?: boolean;
  internalOrderId: string;
  orderReference: string;
  providerOrderId: string;
  keyId?: string;
  amountPaise: number;
  currency: string;
  name: string;
  description: string;
  checkout?: CheckoutDescriptor;
};

type Props = {
  assessmentId: string;
  productSlug: string;
  resultToken: string;
  productName: string;
  subtotal: string;
  gst: string;
  total: string;
  customerName: string;
  customerMobile: string;
  referralCode?: string;
};

export function CheckoutClient(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [activeOrderReference, setActiveOrderReference] = useState("");
  const payInFlight = useRef(false);
  const leavingRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const release = useCallback(
    (message?: string) => {
      clearWatchdog();
      payInFlight.current = false;
      setBusy(false);
      if (message) {
        setError(message);
        setFailed(true);
      }
    },
    [clearWatchdog],
  );

  // A restored page (back button / bfcache) means the user came back unpaid.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      leavingRef.current = false;
      setResumeAvailable(true);
      release();
    };
    const onPageHide = () => {
      leavingRef.current = true;
      clearWatchdog();
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onPageHide);
      clearWatchdog();
    };
  }, [clearWatchdog, release]);

  async function completeVerified(
    verified: { orderReference: string; reportId: string; reportToken: string },
    provider: string,
  ) {
    trackEvent("payment_completed", { product: props.productSlug, provider });
    router.push(
      `/payment/success?order=${encodeURIComponent(verified.orderReference)}&report=${verified.reportId}&token=${encodeURIComponent(verified.reportToken)}`,
    );
  }

  const armRedirectWatchdog = useCallback(() => {
    leavingRef.current = false;
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      if (!shouldRecoverFromBlockedRedirect({ leaving: leavingRef.current, visibility: document.visibilityState })) return;
      release(REDIRECT_BLOCKED_MESSAGE);
    }, REDIRECT_WATCHDOG_MS);
  }, [clearWatchdog, release]);

  /** Top-level form POST to the provider-hosted payment page. */
  function submitHostedCheckout(actionUrl: string, fields: Record<string, string>) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = actionUrl;
    form.target = "_self";
    form.style.display = "none";
    for (const [key, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);

    // Resume must stay available: the user may come back from the hosted page unpaid.
    setResumeAvailable(true);
    armRedirectWatchdog();

    form.submit();
  }

  async function pay(options?: { resume?: boolean }) {
    if (!canStartPayment({ busy, inFlight: payInFlight.current })) return;
    payInFlight.current = true;
    setBusy(true);
    setError("");
    setFailed(false);
    trackEvent(options?.resume ? "checkout_resumed" : "checkout_opened", { product: props.productSlug });

    try {
      const orderResponse = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assessmentId: props.assessmentId,
          productSlug: props.productSlug,
          resultToken: props.resultToken,
          referralCode: props.referralCode,
        }),
      });
      const order = (await orderResponse.json()) as CreateOrderResponse;
      if (!orderResponse.ok) {
        if (order.resumable && order.orderReference) {
          setResumeAvailable(true);
          setActiveOrderReference(order.orderReference);
        }
        const missing = Array.isArray(order.missing) && order.missing.length ? `, missing: ${order.missing.join(", ")}` : "";
        const suffix =
          typeof order.provider === "string"
            ? ` (provider: ${order.provider}${order.keyConfigured === false ? ", keys missing" : ""}${missing})`
            : "";
        throw new Error(`${order.error || "Payment order could not be created."}${suffix}`);
      }

      if (order.orderReference) setActiveOrderReference(order.orderReference);

      const checkout =
        order.checkout ||
        (order.provider === "mock"
          ? ({ mode: "mock" } as const)
          : ({ mode: "razorpay_modal", keyId: order.keyId || "", orderId: order.providerOrderId } as const));

      if (checkout.mode === "cashfree_hosted") {
        submitHostedCheckout(checkout.actionUrl, checkout.fields);
        return;
      }

      if (checkout.mode === "payu_hosted") {
        submitHostedCheckout(checkout.actionUrl, checkout.fields);
        return;
      }

      if (checkout.mode === "mock" || order.provider === "mock") {
        const response = await fetch("/api/payments/mock-complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ internalOrderId: order.internalOrderId, resultToken: props.resultToken }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Test payment could not be completed.");
        await completeVerified(data, "mock");
        return;
      }

      if (checkout.mode === "phonepe_redirect") {
        setResumeAvailable(true);
        armRedirectWatchdog();
        window.location.assign(checkout.redirectUrl);
        return;
      }

      if (checkout.mode === "razorpay_modal") {
        await loadScript("https://checkout.razorpay.com/v1/checkout.js", () => Boolean(window.Razorpay));
        if (!window.Razorpay) throw new Error("The secure payment window could not be opened. Disable blockers and try again.");
        const rzp = new window.Razorpay({
          key: checkout.keyId || order.keyId,
          amount: order.amountPaise,
          currency: order.currency,
          name: order.name,
          description: order.description,
          order_id: checkout.orderId || order.providerOrderId,
          prefill: { name: props.customerName, contact: props.customerMobile.replace("+91", "") },
          theme: { color: "#0a9265" },
          modal: {
            ondismiss: () => {
              setResumeAvailable(true);
              release();
            },
            confirm_close: true,
          },
          handler: async (payment: Record<string, string>) => {
            try {
              const verifyResponse = await fetch("/api/payments/verify", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ internalOrderId: order.internalOrderId, ...payment }),
              });
              const verified = await verifyResponse.json();
              if (!verifyResponse.ok) {
                release(verified.error || "Payment could not be verified.");
                return;
              }
              await completeVerified(verified, "razorpay");
            } catch {
              release("Payment was taken but verification failed. Contact support with your payment reference.");
            }
          },
        });
        rzp.on("payment.failed", (response) => {
          router.push(
            `/payment/failed?assessment=${props.assessmentId}&product=${props.productSlug}&token=${encodeURIComponent(props.resultToken)}&reason=${encodeURIComponent(response.error?.description || "Payment could not be completed")}`,
          );
        });
        rzp.open();
        return;
      }

      throw new Error("Unsupported checkout mode for the configured payment provider.");
    } catch (caught) {
      release(caught instanceof Error ? caught.message : "Payment could not be started.");
    }
  }

  const buttonLabel = checkoutButtonLabel({ busy, failed, resumable: resumeAvailable });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
      <div className="rounded-[2rem] border border-line/80 bg-white p-6 shadow-soft sm:p-8">
        <div className="flex items-start justify-between gap-5 border-b border-line pb-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-700">One-time payment</p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.035em] text-navy-950">{props.productName}</h2>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-100 text-brand-700">
            <ReceiptText size={21} />
          </span>
        </div>

        <div className="mt-6 grid gap-3 rounded-3xl bg-surface p-5 text-sm sm:p-6">
          <Price label={props.productName} value={props.subtotal} />
          <Price label="GST (18%)" value={props.gst} />
          <div className="border-t border-line pt-4">
            <Price label="Total payable" value={props.total} strong />
          </div>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
          <CircleAlert className="mt-1 shrink-0" size={19} aria-hidden="true" />
          {PAYMENT_DESCRIPTION}
        </div>
        {error ? (
          <div className="mt-5" aria-live="polite">
            <StatusNotice tone="error">{error}</StatusNotice>
          </div>
        ) : null}
        {activeOrderReference ? (
          <p className="mt-4 text-center text-xs font-semibold text-slate-500" aria-live="polite">
            Payment reference: {activeOrderReference}
          </p>
        ) : null}

        <Button
          size="lg"
          className="mt-6 w-full"
          onClick={() => void pay({ resume: resumeAvailable })}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : <LockKeyhole size={18} />}
          {buttonLabel}
        </Button>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs leading-5 text-slate-500">
          <ShieldCheck className="shrink-0 text-brand-700" size={15} />
          Payment opens on the secure Cashfree page only when you tap the button. Your ₹{""}
          {props.total.replace(/[^\d.]/g, "")} is charged once.
        </p>
      </div>

      <aside className="rounded-[2rem] bg-navy-950 p-6 text-white shadow-card sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-500">What you unlock after payment</p>
        <div className="mt-7 grid gap-5">
          {[
            "Personalized Credit Profile Booster analysis",
            "Downloadable action plan PDF",
            "Official partner apply links (matched first)",
            "Refund protection for duplicate payments or system failures",
          ].map((item) => (
            <p key={item} className="flex gap-3 text-sm leading-6 text-slate-300">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-500">
                <Check size={14} strokeWidth={3} />
              </span>
              {item}
            </p>
          ))}
        </div>
        <p className="mt-8 border-t border-white/10 pt-6 text-xs leading-6 text-slate-400">{PLATFORM_DISCLAIMER}</p>
      </aside>
    </div>
  );
}

function Price({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "font-extrabold text-navy-950" : "text-slate-600"}>{label}</span>
      <span className={strong ? "text-xl font-extrabold tracking-[-0.025em] text-navy-950" : "font-bold text-navy-950"}>
        {value}
      </span>
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
      const started = Date.now();
      const poll = window.setInterval(() => {
        if (ready()) {
          window.clearInterval(poll);
          done();
        } else if (Date.now() - started > 10_000) {
          window.clearInterval(poll);
          fail();
        }
      }, 50);
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => done();
    script.onerror = () => fail();
    document.head.appendChild(script);
    window.setTimeout(() => {
      if (ready()) done();
      else if (!settled) fail();
    }, 10_000);
  });
}
