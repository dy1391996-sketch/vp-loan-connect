import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  light = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
  light?: boolean;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? (
        <p className={cn("mb-4 text-[11px] font-extrabold uppercase tracking-[0.22em]", light ? "text-brand-500" : "text-brand-700")}>
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          "font-display text-balance text-3xl font-extrabold leading-[1.12] tracking-[-0.045em] sm:text-4xl lg:text-[2.75rem]",
          light ? "text-white" : "text-navy-950",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className={cn("mt-5 text-base leading-8 sm:text-lg", light ? "text-slate-300" : "text-slate-600")}>{description}</p>
      ) : null}
    </div>
  );
}
