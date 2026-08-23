"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LOAN_PURPOSES,
  MAX_LOAN_AMOUNT,
  MIN_LOAN_AMOUNT,
  QUICK_AMOUNTS,
  formatInrDigits,
  parseInrDigits,
} from "@/lib/apply/quick-apply-state";
import { cn, formatInr } from "@/lib/utils";

export function HomeQuickStart() {
  const router = useRouter();
  const [amount, setAmount] = useState(50_000);
  const [purpose, setPurpose] = useState("Personal expenses");
  const [error, setError] = useState("");

  function startCheck() {
    if (!Number.isFinite(amount) || amount < MIN_LOAN_AMOUNT) {
      setError(`Enter an amount of at least ₹${MIN_LOAN_AMOUNT.toLocaleString("en-IN")}.`);
      return;
    }
    if (amount > MAX_LOAN_AMOUNT) {
      setError(`Maximum amount is ₹${MAX_LOAN_AMOUNT.toLocaleString("en-IN")}.`);
      return;
    }
    if (!purpose.trim()) {
      setError("Select what you need the funds for.");
      return;
    }
    const params = new URLSearchParams({ amount: String(amount), purpose });
    router.push(`/apply/quick?${params.toString()}`);
  }

  return (
    <div className="rounded-[1.75rem] border border-white/12 bg-white/8 p-5 shadow-premium backdrop-blur-md sm:p-6">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-500">Quick start</p>
      <h2 className="font-display mt-2 text-xl font-extrabold text-white">Check loan options for your profile</h2>
      <label className="mt-5 block">
        <span className="text-xs font-bold text-slate-300">Loan amount</span>
        <div className={cn("mt-2 flex min-h-[52px] items-center gap-2 rounded-2xl border bg-navy-950/60 px-4", error.includes("amount") ? "border-red-400" : "border-white/15")}>
          <span className="text-lg font-extrabold text-slate-400">₹</span>
          <input
            className="w-full bg-transparent py-3 text-xl font-extrabold text-white outline-none"
            inputMode="numeric"
            value={formatInrDigits(amount)}
            aria-label="Loan amount"
            onChange={(e) => {
              setError("");
              setAmount(parseInrDigits(e.target.value));
            }}
          />
        </div>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setError("");
              setAmount(value);
            }}
            className={cn(
              "rounded-full border px-3 py-2 text-xs font-extrabold transition",
              amount === value ? "border-brand-500 bg-brand-500/20 text-brand-500" : "border-white/15 text-slate-300 hover:border-brand-500/50",
            )}
          >
            {formatInr(value)}
          </button>
        ))}
      </div>
      <label className="mt-5 block">
        <span className="text-xs font-bold text-slate-300">Purpose</span>
        <select
          className="mt-2 min-h-[52px] w-full rounded-2xl border border-white/15 bg-navy-950/60 px-4 text-sm font-bold text-white outline-none"
          value={purpose}
          onChange={(e) => {
            setError("");
            setPurpose(e.target.value);
          }}
        >
          {LOAN_PURPOSES.map((item) => (
            <option key={item.id} value={item.value} className="text-navy-950">
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="mt-3 text-xs font-semibold text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="button" size="lg" className="mt-5 w-full" onClick={startCheck}>
        Check My Loan Options <ArrowRight size={18} />
      </Button>
      <p className="mt-3 text-xs leading-5 text-slate-400">
        Not a lender. Amount and purpose are saved for after the ₹116.82 Credit Profile Booster. The next screen only asks for name, email and OTP.
      </p>
    </div>
  );
}
