"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

export function RefundOrderButton({ orderId, maxAmount }: { orderId: string; maxAmount: number }) {
  const [open, setOpen] = useState(false); const [amount, setAmount] = useState(maxAmount); const [reason, setReason] = useState(""); const [confirmed, setConfirmed] = useState(false); const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  async function submit() { setBusy(true); setStatus(""); const response = await fetch(`/api/admin/orders/${orderId}/refund`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount, reason, confirmed }) }); const data = await response.json(); setStatus(response.ok ? `Refund completed: ${data.providerRefundId}` : data.error); setBusy(false); if (response.ok) setTimeout(() => location.reload(), 800); }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-bold text-navy-900"><RotateCcw size={13} />Refund</button>;
  return <div className="w-72 rounded-xl border border-line bg-white p-4 shadow-card"><Field label={`Amount (max ₹${maxAmount.toFixed(2)})`}><Input type="number" min={0.01} max={maxAmount} step={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field><label className="mt-3 grid gap-1 text-xs font-bold">Reason<textarea className="min-h-20 rounded-lg border border-line p-2 font-normal" value={reason} onChange={(e) => setReason(e.target.value)} /></label><label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />I confirm this refund and understand it may reverse referral rewards.</label>{status ? <p className="mt-2 text-xs leading-5 text-slate-600">{status}</p> : null}<div className="mt-3 flex gap-2"><Button type="button" size="sm" variant="danger" disabled={!confirmed || reason.trim().length < 10 || busy} onClick={submit}>{busy ? "Processing…" : "Process refund"}</Button><Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div></div>;
}
