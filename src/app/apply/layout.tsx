import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

/** Funnel layout — site Header/Footer are suppressed by SiteShell for /apply/*. */
export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
