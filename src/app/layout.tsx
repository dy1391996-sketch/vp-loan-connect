import type { Metadata, Viewport } from "next";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "@fontsource/noto-sans-devanagari/700.css";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { APP_NAME, TAGLINE } from "@/lib/constants";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://vploanconnect.in"),
  title: { default: `${APP_NAME} | ${TAGLINE}`, template: `%s | ${APP_NAME}` },
  description: "Income, EMI, credit profile और document readiness के आधार पर free preliminary loan-options assessment और educational reports.",
  applicationName: APP_NAME,
  category: "financial education",
  keywords: ["loan readiness", "credit health", "EMI calculator", "financial education", "India"],
  authors: [{ name: "THE99CREW FACILITY MANAGEMENT" }],
  openGraph: {
    type: "website",
    locale: "hi_IN",
    siteName: APP_NAME,
    title: `${APP_NAME} — Smart Profile Check`,
    description: "Loan application से पहले अपनी income, EMI, credit health और documents check करें.",
    url: "/",
  },
  twitter: { card: "summary_large_image", title: APP_NAME, description: TAGLINE },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#061728",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hi">
      <body>
        <AnalyticsProvider />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
