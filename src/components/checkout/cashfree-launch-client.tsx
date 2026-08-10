"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import {
  createCashfreeSdk,
  isCashfreeCheckoutModalOpen,
  launchCashfreeCheckoutWithTimeout,
  type CashfreeCheckoutInstance,
} from "@/lib/payments/cashfree-browser";

declare global {
  interface Window {
    Cashfree?: ((options: { mode: "sandbox" | "production" }) => CashfreeCheckoutInstance) &
      (new (options: { mode: "sandbox" | "production" }) => CashfreeCheckoutInstance);
  }
}

export const CASHFREE_LAUNCH_STORAGE_KEY = "vplc_cashfree_launch_v1";

export type CashfreeLaunchPayload = {
  paymentSessionId: string;
  env: "sandbox" | "production";
  orderReference: string;
  returnTo: string;
};

export function readCashfreeLaunchPayload(): CashfreeLaunchPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CASHFREE_LAUNCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CashfreeLaunchPayload>;
    if (
      typeof parsed.paymentSessionId !== "string" ||
      parsed.paymentSessionId.length < 10 ||
      (parsed.env !== "sandbox" && parsed.env !== "production") ||
      typeof parsed.orderReference !== "string" ||
      typeof parsed.returnTo !== "string"
    ) {
      return null;
    }
    return {
      paymentSessionId: parsed.paymentSessionId,
      env: parsed.env,
      orderReference: parsed.orderReference,
      returnTo: parsed.returnTo,
    };
  } catch {
    return null;
  }
}

export function writeCashfreeLaunchPayload(payload: CashfreeLaunchPayload) {
  window.sessionStorage.setItem(CASHFREE_LAUNCH_STORAGE_KEY, JSON.stringify(payload));
}

export function clearCashfreeLaunchPayload() {
  window.sessionStorage.removeItem(CASHFREE_LAUNCH_STORAGE_KEY);
}

async function loadCashfreeScript() {
  if (window.Cashfree) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://sdk.cashfree.com/js/v3/cashfree.js"]');
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(new Error("Cashfree checkout could not be loaded."));
    };
    if (existing) {
      existing.addEventListener("load", () => done(), { once: true });
      existing.addEventListener("error", () => fail(), { once: true });
      const started = Date.now();
      const poll = window.setInterval(() => {
        if (window.Cashfree) {
          window.clearInterval(poll);
          done();
        } else if (Date.now() - started > 10_000) {
          window.clearInterval(poll);
          fail();
        }
      }, 40);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => done();
    script.onerror = () => fail();
    document.head.appendChild(script);
    window.setTimeout(() => {
      if (window.Cashfree) done();
      else if (!settled) fail();
    }, 10_000);
  });
}

export function CashfreeLaunchClient() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState("");
  const [returnTo, setReturnTo] = useState("/apply/quick");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function launch() {
      const payload = readCashfreeLaunchPayload();
      if (!payload) {
        setError("Payment session expired. Go back and tap Proceed to secure payment again.");
        return;
      }
      setReturnTo(payload.returnTo || "/apply/quick");
      // One-shot payload — prevents accidental double launch on refresh.
      clearCashfreeLaunchPayload();

      try {
        await loadCashfreeScript();
        if (!window.Cashfree) throw new Error("Cashfree checkout could not be loaded. Disable blockers and try again.");
        const cashfree = createCashfreeSdk(window.Cashfree, payload.env);
        const outcome = await launchCashfreeCheckoutWithTimeout(cashfree, {
          paymentSessionId: payload.paymentSessionId,
          redirectTarget: "_top",
        });

        if (outcome.kind === "navigating" || outcome.kind === "redirecting") {
          return;
        }

        // Modal/popup is explicitly not accepted for this product flow.
        if (isCashfreeCheckoutModalOpen()) {
          setError("Secure hosted payment page did not open. Return and resume payment.");
          return;
        }

        if (outcome.kind === "error") {
          setError(outcome.cancelled ? "Payment was cancelled." : outcome.message || "Payment not completed — Try again");
          return;
        }

        setError("Payment not completed — Try again");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Payment not completed — Try again");
      }
    }

    void launch();
  }, [router]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-[2rem] border border-line bg-white p-8 text-center shadow-soft">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-800">
          <ShieldAlert size={22} />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-[-0.04em] text-navy-950">Payment not completed</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600" aria-live="polite">
          {error}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <ButtonLink href={returnTo} size="md">
            Try again
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary" size="md">
            Contact support
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg rounded-[2rem] border border-line bg-white p-8 text-center shadow-soft">
      <Loader2 className="mx-auto animate-spin text-brand-700" size={28} />
      <h1 className="mt-5 text-2xl font-extrabold tracking-[-0.04em] text-navy-950">Preparing secure payment…</h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        You are being redirected to Cashfree&apos;s secure hosted payment page for ₹116.82. Do not close this window.
      </p>
    </div>
  );
}
