"use client";

import { useMemo, useState } from "react";
import { Field, Input } from "@/components/ui/form";
import { calculateEmi } from "@/lib/domain/emi";
import { formatInr } from "@/lib/utils";

type EmiCalculatorProps = {
  initialPrincipal?: number;
  initialRate?: number;
  initialMonths?: number;
};

export function EmiCalculator({
  initialPrincipal = 500000,
  initialRate = 14,
  initialMonths = 36,
}: EmiCalculatorProps = {}) {
  const [principal, setPrincipal] = useState(initialPrincipal);
  const [rate, setRate] = useState(initialRate);
  const [months, setMonths] = useState(initialMonths);
  const result = useMemo(() => calculateEmi(Math.max(1, principal), Math.max(0, rate), Math.max(1, Math.round(months))), [principal, rate, months]);
  return (
    <div className="rounded-[2rem] border border-line/80 bg-white p-6 shadow-soft sm:p-9">
      <div className="grid gap-5 sm:grid-cols-3"><Field label="Principal (₹)"><Input className="number-field" type="number" min={50000} max={1500000} step={10000} value={principal} onChange={(e) => setPrincipal(Number(e.target.value))} /></Field><Field label="Annual rate (%)"><Input className="number-field" type="number" min={0} max={100} step={0.25} value={rate} onChange={(e) => setRate(Number(e.target.value))} /></Field><Field label="Tenure (months)"><Input className="number-field" type="number" min={1} max={360} value={months} onChange={(e) => setMonths(Number(e.target.value))} /></Field></div>
      <div className="mt-8 grid gap-3 sm:grid-cols-3" aria-live="polite"><Result label="Indicative monthly EMI" value={formatInr(result.monthlyEmi)} strong /><Result label="Total repayment" value={formatInr(result.totalRepayment)} /><Result label="Total interest" value={formatInr(result.totalInterest)} /></div>
      <p className="mt-6 text-xs leading-6 text-slate-500">Estimate only. This calculator uses the reducing-balance formula and excludes lender fees, insurance and other charges.</p>
    </div>
  );
}

function Result({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div className={strong ? "rounded-2xl bg-navy-950 p-5 text-white shadow-card" : "rounded-2xl bg-surface p-5 text-navy-950"}><p className="text-xs font-semibold opacity-65">{label}</p><p className="mt-2 text-xl font-extrabold tracking-[-0.035em]">{value}</p></div>; }
