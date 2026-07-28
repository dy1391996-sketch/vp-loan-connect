import type { Metadata, Viewport } from "next";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "@fontsource/noto-sans-devanagari/700.css";
import "@fontsource/noto-sans-devanagari/800.css";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { APP_NAME, TAGLINE } from "@/lib/constants";

export const metadata: Metadata = {
  verification: {
    google: "4F1i1VfD52pj7yuswc0nHv-FPUd1gqBV7IaHNjIZzfY",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://vploanconnect.in"),
  title: { default: `${APP_NAME} | ${TAGLINE}`, template: `%s | ${APP_NAME}` },
  description: "Check your loan readiness in two minutes with a free preliminary analysis of income, EMI, documents and credit profile.",
  applicationName: APP_NAME,
  category: "financial education",
  keywords: ["loan readiness", "credit health", "EMI calculator", "financial education", "India"],
  authors: [{ name: APP_NAME }],
  openGraph: {
    type: "website",
    locale: "hi_IN",
    siteName: APP_NAME,
    title: `${APP_NAME} — Check Your Loan Readiness`,
    description: "सिर्फ 2 मिनट में अपनी income, EMI, documents और credit profile के आधार पर loan readiness समझें.",
    url: "/",
    images: [{ url: "/og.jpg", width: 1200, height: 627, alt: "VP Loan Connect — Check Your Loan Readiness in Just 2 Minutes" }],
  },
  twitter: { card: "summary_large_image", title: APP_NAME, description: TAGLINE, images: ["/og.jpg"] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#061728",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body>
        <AnalyticsProvider />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
