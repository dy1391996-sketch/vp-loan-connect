"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Loader2, LockKeyhole, ReceiptText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusNotice } from "@/components/ui/status-notice";
import { PAYMENT_DESCRIPTION, PLATFORM_DISCLAIMER } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics-client";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: (response: { error?: { description?: string } }) => void) => void;
    };
  }
}

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

  async function pay() {
    setBusy(true);
    setError("");
    trackEvent("checkout_opened", { product: props.productSlug });

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
      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.error || "Payment order could not be created.");

      if (order.provider === "mock") {
        const response = await fetch("/api/payments/mock-complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ internalOrderId: order.internalOrderId, resultToken: props.resultToken }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Test payment could not be completed.");
        trackEvent("payment_completed", { product: props.productSlug, provider: "mock" });
        router.push(`/payment/success?order=${encodeURIComponent(data.orderReference)}&report=${data.reportId}&token=${encodeURIComponent(data.reportToken)}`);
        return;
      }

      await loadRazorpay();
      if (!window.Razorpay) throw new Error("The secure payment window could not be opened.");

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.providerOrderId,
        prefill: { name: props.customerName, contact: props.customerMobile.replace("+91", "") },
        theme: { color: "#0a9265" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (payment: Record<string, string>) => {
          const verifyResponse = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ internalOrderId: order.internalOrderId, ...payment }),
          });
          const verified = await verifyResponse.json();
          if (!verifyResponse.ok) {
            setError(verified.error || "Payment could not be verified.");
            setBusy(false);
            return;
          }
          trackEvent("payment_completed", { product: props.productSlug, provider: "razorpay" });
          router.push(`/payment/success?order=${encodeURIComponent(verified.orderReference)}&report=${verified.reportId}&token=${encodeURIComponent(verified.reportToken)}`);
        },
      });

      checkout.on("payment.failed", (response) => {
        router.push(`/payment/failed?assessment=${props.assessmentId}&product=${props.productSlug}&token=${encodeURIComponent(props.resultToken)}&reason=${encodeURIComponent(response.error?.description || "Payment could not be completed")}`);
      });
      checkout.open();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment could not be started.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
      <div className="rounded-[2rem] border border-line/80 bg-white p-6 shadow-soft sm:p-8">
        <div className="flex items-start justify-between gap-5 border-b border-line pb-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-700">Selected ₹99 Credit Profile Booster</p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.035em] text-navy-950">{props.productName}</h2>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700"><ReceiptText size={21} /></span>
        </div>

        <div className="mt-6 grid gap-3 rounded-3xl bg-surface p-5 text-sm sm:p-6">
          <Price label="Plan fee" value={props.subtotal} />
          <Price label="GST (18%)" value={props.gst} />
          <div className="border-t border-line pt-4"><Price label="Total payable" value={props.total} strong /></div>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
          <CircleAlert className="mt-1 shrink-0" size={19} aria-hidden="true" />{PAYMENT_DESCRIPTION}
        </div>
        {error ? <StatusNotice tone="error" className="mt-5">{error}</StatusNotice> : null}

        <Button size="lg" className="mt-6 w-full" onClick={pay} disabled={busy} aria-busy={busy}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : <LockKeyhole size={18} />}
          {busy ? "Opening secure payment…" : `Pay securely: ${props.total}`}
        </Button>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs leading-5 text-slate-500">
          <ShieldCheck className="shrink-0 text-brand-700" size={15} /> Payment order creation and verification are completed securely on the server.
        </p>
      </div>

      <aside className="rounded-[2rem] bg-navy-950 p-6 text-white shadow-card sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-500">What you unlock after payment</p>
        <div className="mt-7 grid gap-5">
          {["Personalized Credit Profile Booster analysis", "Downloadable action plan PDF", "Time-limited secure report access", "Refund protection for duplicate payments or system failures"].map((item) => (
            <p key={item} className="flex gap-3 text-sm leading-6 text-slate-300"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-500"><Check size={14} strokeWidth={3} /></span>{item}</p>
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
      <span className={strong ? "text-xl font-extrabold tracking-[-0.025em] text-navy-950" : "font-bold text-navy-950"}>{value}</span>
    </div>
  );
}

async function loadRazorpay() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay checkout could not be loaded."));
    document.head.appendChild(script);
  });
}
