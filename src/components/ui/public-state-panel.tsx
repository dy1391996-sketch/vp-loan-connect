import { LockKeyhole, type LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function PublicStatePanel({
  icon: Icon = LockKeyhole,
  eyebrow = "Secure access",
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <section className="surface-grid grid min-h-[68vh] place-items-center bg-surface py-16">
      <div className="page-shell">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-line/80 bg-white p-7 text-center shadow-soft sm:p-10">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-brand-100 text-brand-700">
            <Icon size={28} aria-hidden="true" />
          </span>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">{eyebrow}</p>
          <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-[-0.045em] text-navy-950">{title}</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-600">{description}</p>
          {action ? <ButtonLink href={action.href} variant="secondary" className="mt-7">{action.label}</ButtonLink> : null}
        </div>
      </div>
    </section>
  );
}
