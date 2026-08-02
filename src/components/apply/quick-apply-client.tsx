"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureAttributionFromSearch, getAttributionPayload } from "@/lib/attribution";
import { USP_PRICE_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

const AMOUNTS = [
  { label: "₹5k", value: 5000 },
  { label: "₹10k", value: 10000 },
  { label: "₹25k", value: 25000 },
  { label: "₹50k", value: 50000 },
  { label: "₹1L", value: 100000 },
  { label: "₹2L", value: 200000 },
] as const;

const PURPOSES = [
  ["Medical or emergency expense", "Medical"],
  ["Other personal need", "Emergency"],
  ["Household bills or family need", "Month-end"],
  ["Travel or wedding", "Travel"],
  ["Travel or wedding", "Festival"],
  ["Travel or wedding", "Wedding"],
  ["Business working capital", "Business"],
  ["Education expense", "Education"],
] as const;

export function QuickApplyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [amount, setAmount] = useState(10000);
  const [customAmount, setCustomAmount] = useState("10,000");
  const [purpose, setPurpose] = useState("Other personal need");
  const [purposeLabel, setPurposeLabel] = useState("Emergency");

  const attribution = useMemo(() => {
    captureAttributionFromSearch(searchParams);
    return getAttributionPayload(searchParams);
  }, [searchParams]);

  function selectAmount(value: number) {
    setAmount(value);
    setCustomAmount(new Intl.NumberFormat("en-IN").format(value));
  }

  function onCustomChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      setCustomAmount("");
      return;
    }
    const next = Math.min(500000, Math.max(0, Number(digits)));
    setAmount(next);
    setCustomAmount(new Intl.NumberFormat("en-IN").format(next));
  }

  function continueApply() {
    const loanAmount = Math.min(500000, Math.max(5000, amount || 10000));
    const loanType = purpose === "Business working capital" ? "BUSINESS" : "PERSONAL";
    const params = new URLSearchParams({
      amount: String(loanAmount),
      loanType,
      purpose,
      source: attribution.utm_source || searchParams.get("utm_source") || "quick_apply",
    });
    for (const [key, value] of Object.entries(attribution)) {
      if (value && !params.has(key)) params.set(key, value);
    }
    router.push(`/assessment?${params.toString()}`);
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-8 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {(
          [
            { n: "1", label: "Amount", active: true },
            { n: "2", label: "Profile", active: false },
            { n: "3", label: "Free result", active: false },
            { n: "4", label: `${USP_PRICE_LABEL} unlock`, active: false },
          ] as const
        ).map((step, index, list) => (
          <div key={step.label} className="flex items-center gap-2">
            <span className={cn("grid h-7 w-7 place-items-center rounded-full text-[11px]", step.active ? "bg-brand-600 text-white" : "bg-line text-slate-500")}>
              {step.n}
            </span>
            <span className={cn(step.active ? "text-brand-700" : "text-slate-400")}>{step.label}</span>
            {index < list.length - 1 ? <span className="mx-1 h-px w-6 bg-line sm:w-10" /> : null}
          </div>
        ))}
      </div>

      <div className="rounded-[1.75rem] border border-line bg-white p-6 shadow-soft sm:p-8">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-700">
          <Sparkles size={14} />
          Quick apply
        </div>
        <h1 className="font-display mt-4 text-3xl font-extrabold tracking-[-0.045em] text-navy-950 sm:text-4xl">
          How much do you need?
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Amount choose karo. Free profile check pehle — phir optional {USP_PRICE_LABEL} Credit Profile Booster se official loan links unlock.
        </p>

        <label className="mt-8 block">
          <span className="text-sm font-bold text-navy-950">Loan amount</span>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
            <span className="text-lg font-extrabold text-slate-400">₹</span>
            <input
              className="w-full bg-transparent text-2xl font-extrabold tracking-[-0.03em] text-navy-950 outline-none"
              inputMode="numeric"
              value={customAmount}
              onChange={(e) => onCustomChange(e.target.value)}
              aria-label="How much do you need?"
            />
          </div>
        </label>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {AMOUNTS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => selectAmount(item.value)}
              className={cn(
                "rounded-xl border px-2 py-3 text-sm font-extrabold transition",
                amount === item.value ? "border-brand-600 bg-brand-100 text-brand-800" : "border-line bg-white text-navy-950 hover:border-brand-500",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="mt-7 text-sm font-bold text-navy-950">What do you need money for?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PURPOSES.map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setPurpose(value);
                setPurposeLabel(label);
              }}
              className={cn(
                "rounded-xl border px-3.5 py-2.5 text-sm font-bold transition",
                purposeLabel === label ? "border-brand-600 bg-brand-100 text-brand-800" : "border-line bg-white text-slate-700 hover:border-brand-500",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <strong>Honest pricing:</strong> Hum loan amount ka 10% fee nahi lete. Free check pehle. Matched official platforms unlock karne ke liye optional {USP_PRICE_LABEL} + GST — approval guarantee nahi.
        </div>

        <Button type="button" size="lg" className="mt-6 w-full" onClick={continueApply}>
          Continue to free profile check <ArrowRight size={18} />
        </Button>

        <div className="mt-5 grid gap-3 text-xs leading-6 text-slate-500 sm:grid-cols-2">
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 shrink-0 text-brand-700" size={15} />
            No fake “instant cash in 30 minutes” promise from VP Loan Connect.
          </p>
          <p className="flex items-start gap-2">
            <LockKeyhole className="mt-0.5 shrink-0 text-brand-700" size={15} />
            After {USP_PRICE_LABEL} payment you get official loan-connect links — lender decides approval.
          </p>
        </div>
      </div>
    </div>
  );
}
