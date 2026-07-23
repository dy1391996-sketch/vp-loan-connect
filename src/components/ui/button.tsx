import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-brand-600 text-white shadow-[0_12px_32px_rgba(10,146,101,0.27)] hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-[0_16px_38px_rgba(10,146,101,0.3)]",
  secondary: "border border-navy-800/12 bg-white text-navy-900 shadow-sm hover:-translate-y-0.5 hover:border-brand-600/50 hover:text-brand-700 hover:shadow-card",
  dark: "bg-navy-950 text-white shadow-[0_12px_30px_rgba(6,21,33,0.18)] hover:-translate-y-0.5 hover:bg-navy-800",
  ghost: "text-navy-800 hover:bg-surface",
  danger: "bg-red-700 text-white shadow-sm hover:bg-red-800",
};

const sizes = {
  sm: "min-h-11 px-5 py-2.5 text-sm",
  md: "min-h-13 px-6 py-3 text-sm",
  lg: "min-h-15 px-7 py-4 text-base",
};

type SharedProps = {
  children: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
};

export function Button({ children, variant = "primary", size = "md", className, ...props }: SharedProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn("inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition duration-200 disabled:cursor-not-allowed disabled:transform-none disabled:opacity-55", variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({ href, children, variant = "primary", size = "md", className }: SharedProps & { href: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition duration-200", variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}
