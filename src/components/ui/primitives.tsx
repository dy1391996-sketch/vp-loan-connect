import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-50",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "px-5 py-3 text-base",
        variant === "primary" && "bg-copper-600 text-white hover:bg-copper-500 shadow-sm",
        variant === "secondary" && "bg-ink-900 text-sand-50 hover:bg-ink-800",
        variant === "ghost" && "bg-transparent text-ink-800 hover:bg-sand-100",
        variant === "danger" && "bg-rose-500 text-white hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line/80 bg-white/80 backdrop-blur-sm shadow-sm", className)} {...props} />;
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warn" | "danger" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-sand-100 text-ink-800",
        tone === "success" && "bg-teal-100 text-teal-600",
        tone === "warn" && "bg-copper-100 text-copper-600",
        tone === "danger" && "bg-rose-500/15 text-rose-500",
        tone === "info" && "bg-ink-800/10 text-ink-800",
      )}
    >
      {children}
    </span>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-700/50 focus:border-copper-500",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-copper-500",
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-700/50 focus:border-copper-500",
        props.className,
      )}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-700/80">{children}</label>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-ink-700/80">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="p-8 text-center">
      <p className="font-display text-lg text-ink-900">{title}</p>
      <p className="mt-2 text-sm text-ink-700/70">{description}</p>
    </Card>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-4 animate-fade-up">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/60">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-ink-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-700/60">{hint}</p> : null}
    </Card>
  );
}
