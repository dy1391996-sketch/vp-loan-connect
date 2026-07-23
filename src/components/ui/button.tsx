import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-brand-600 text-white shadow-[0_10px_28px_rgba(12,147,104,0.26)] hover:bg-brand-700",
  secondary: "border border-navy-800/15 bg-white text-navy-900 hover:border-brand-600 hover:text-brand-700",
  dark: "bg-navy-950 text-white hover:bg-navy-800",
  ghost: "text-navy-800 hover:bg-surface",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

const sizes = {
  sm: "min-h-10 px-4 py-2 text-sm",
  md: "min-h-12 px-5 py-3 text-sm",
  lg: "min-h-14 px-6 py-3.5 text-base",
};

type SharedProps = {
  children: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
};

export function Button({ children, variant = "primary", size = "md", className, ...props }: SharedProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-55", variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({ href, children, variant = "primary", size = "md", className }: SharedProps & { href: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition", variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}
