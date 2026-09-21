import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "@fontsource/noto-sans-devanagari/700.css";
import "@fontsource/noto-sans-devanagari/800.css";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SiteShell } from "@/components/layout/site-shell";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { AttributionCapture } from "@/components/attribution-capture";
import { MarketingConsentBanner } from "@/components/marketing-consent-banner";
import { APP_NAME, TAGLINE } from "@/lib/constants";
import { getPublicAppUrl } from "@/lib/env";

export const metadata: Metadata = {
  verification: {
    google: "4F1i1VfD52pj7yuswc0nHv-FPUd1gqBV7IaHNjIZzfY",
  },
  metadataBase: new URL(getPublicAppUrl()),
  title: { default: `${APP_NAME} — Loan Match & Readiness Report`, template: `%s | ${APP_NAME}` },
  description: "Understand your loan readiness, key eligibility factors and matched loan options through VP Loan Connect.",
  applicationName: APP_NAME,
  category: "financial education",
  keywords: ["loan match", "loan readiness report", "loan readiness", "EMI calculator", "personal loan India", "VP Loan Connect"],
  authors: [{ name: APP_NAME }],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: APP_NAME,
    title: `${APP_NAME} — Loan Match & Readiness Report`,
    description: "Understand your loan readiness, key eligibility factors and matched loan options through VP Loan Connect.",
    url: "/",
    images: [{ url: "/og.jpg", width: 1200, height: 627, alt: "VP Loan Connect — Loan Match & Readiness Report" }],
  },
  twitter: { card: "summary_large_image", title: APP_NAME, description: TAGLINE, images: ["/og.jpg"] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#102A43",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body>
        <a
          href="#main-content"
          className="absolute left-[-10000px] top-4 z-[100] rounded-xl bg-brand-500 px-4 py-3 font-bold text-navy-950 focus:left-4"
        >
          Skip to main content
        </a>
        <AnalyticsProvider />
        <Suspense fallback={null}>
          <AttributionCapture />
        </Suspense>
        <SiteShell>{children}</SiteShell>
        <MarketingConsentBanner />
        <Analytics />
      </body>
    </html>
  );
}
