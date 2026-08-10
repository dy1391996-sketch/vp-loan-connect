import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { DM_Sans, Manrope } from "next/font/google";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "@fontsource/noto-sans-devanagari/700.css";
import "@fontsource/noto-sans-devanagari/800.css";
import "./globals.css";
import { SiteShell } from "@/components/layout/site-shell";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { AttributionCapture } from "@/components/attribution-capture";
import { MarketingConsentBanner } from "@/components/marketing-consent-banner";
import { APP_NAME, TAGLINE } from "@/lib/constants";
import { getPublicAppUrl } from "@/lib/env";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  verification: {
    google: "4F1i1VfD52pj7yuswc0nHv-FPUd1gqBV7IaHNjIZzfY",
  },
  metadataBase: new URL(getPublicAppUrl()),
  title: { default: `${APP_NAME} | ${TAGLINE}`, template: `%s | ${APP_NAME}` },
  description: "Free loan profile check and ₹99 Credit Profile Booster — understand credit readiness and see profile-matched loan options in India.",
  applicationName: APP_NAME,
  category: "financial education",
  keywords: ["credit profile booster", "loan matching", "loan readiness", "EMI calculator", "personal loan India", "VP Loan Connect"],
  authors: [{ name: APP_NAME }],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: APP_NAME,
    title: `${APP_NAME} — Free Check + ₹99 Credit Profile Booster`,
    description: "Analyse your credit profile and discover profile-matched loan options. Free check first.",
    url: "/",
    images: [{ url: "/og.jpg", width: 1200, height: 627, alt: "VP Loan Connect — Credit Profile Booster" }],
  },
  twitter: { card: "summary_large_image", title: APP_NAME, description: TAGLINE, images: ["/og.jpg"] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#061521",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${manrope.variable} ${dmSans.variable}`}>
      <body className={dmSans.className}>
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
      </body>
    </html>
  );
}
