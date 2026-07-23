import { cn } from "@/lib/utils";

export function SectionHeading({ eyebrow, title, description, align = "left", className }: { eyebrow?: string; title: string; description?: string; align?: "left" | "center"; className?: string }) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{eyebrow}</p> : null}
      <h2 className="text-balance text-3xl font-bold tracking-[-0.035em] text-navy-950 sm:text-4xl lg:text-5xl">{title}</h2>
      {description ? <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">{description}</p> : null}
    </div>
  );
}
