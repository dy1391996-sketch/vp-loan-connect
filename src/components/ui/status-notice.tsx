import { CircleAlert, CircleCheck, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  success: {
    container: "border-brand-500/25 bg-brand-100/70 text-brand-700",
    icon: CircleCheck,
  },
  error: {
    container: "border-red-200 bg-red-50 text-red-800",
    icon: CircleAlert,
  },
  info: {
    container: "border-line bg-surface text-slate-700",
    icon: Info,
  },
} as const;

export function StatusNotice({
  tone,
  title,
  children,
  icon,
  className,
}: {
  tone: keyof typeof tones;
  title?: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const config = tones[tone];
  const Icon = icon ?? config.icon;

  return (
    <div
      className={cn("flex items-start gap-3 rounded-2xl border p-4 text-sm leading-6", config.container, className)}
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <Icon className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
      <div>
        {title ? <p className="font-extrabold">{title}</p> : null}
        <div className={title ? "mt-1" : ""}>{children}</div>
      </div>
    </div>
  );
}
