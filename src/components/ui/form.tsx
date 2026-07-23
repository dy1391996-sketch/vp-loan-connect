import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Field({ label, hint, error, required, children }: { label: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-2.5 text-sm font-bold text-navy-900">
      <span>{label}{required ? <span className="ml-1 text-red-600" aria-hidden="true">*</span> : null}</span>
      {children}
      {hint ? <span className="text-xs font-normal leading-5 text-slate-500">{hint}</span> : null}
      {error ? <span className="text-xs font-medium text-red-700" role="alert">{error}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("min-h-14 w-full rounded-2xl border border-line bg-white px-4 text-base text-navy-950 shadow-sm transition placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100 focus:outline-none", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("min-h-14 w-full rounded-2xl border border-line bg-white px-4 text-base text-navy-950 shadow-sm transition hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100 focus:outline-none", className)} {...props}>{children}</select>;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("min-h-32 w-full resize-y rounded-2xl border border-line bg-white px-4 py-3.5 text-base text-navy-950 shadow-sm transition placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100 focus:outline-none", className)} {...props} />;
}

export function Choice({ name, value, label, checked, onChange }: { name: string; value: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition", checked ? "border-brand-600 bg-brand-100 text-brand-700 shadow-sm" : "border-line bg-white text-navy-900 hover:border-slate-400 hover:bg-surface/50")}>
      <input className="h-4 w-4 accent-brand-600" type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
