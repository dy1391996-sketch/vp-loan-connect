"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readMarketingConsent } from "@/lib/consent/marketing-consent";
import { createMetaEventId } from "@/lib/meta/events";
import { getPublicMetaPixelId, trackMetaPixelEvent } from "@/lib/meta/pixel-client";
import { trackEvent } from "@/lib/analytics-client";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}

/** Public GA id — optional. Prefer NEXT_PUBLIC_GA_MEASUREMENT_ID in Vercel. */
function readGaId(): string {
  return String(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_ANALYTICS_ID || "").trim();
}

function sendMetaConversion(eventName: string, eventId: string) {
  void fetch("/api/meta/conversions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eventName,
      eventId,
      eventSourceUrl: window.location.href,
    }),
    keepalive: true,
  }).catch(() => undefined);
}

export function AnalyticsProvider() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<"unknown" | "granted" | "denied">("unknown");
  const [pixelReady, setPixelReady] = useState(false);
  const gaId = readGaId();
  const pixelId = getPublicMetaPixelId();

  useEffect(() => {
    const current = readMarketingConsent();
    setConsent(current ?? "unknown");
    const onConsent = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === "granted" || detail === "denied") setConsent(detail);
    };
    window.addEventListener("vplc:marketing-consent", onConsent as EventListener);
    return () => window.removeEventListener("vplc:marketing-consent", onConsent as EventListener);
  }, []);

  // First-party product analytics (no marketing pixels) — always allowed.
  useEffect(() => {
    if (pathname === "/") {
      trackEvent("homepage_visit");
    }
  }, [pathname]);

  // Consent-gated GA page views.
  useEffect(() => {
    if (consent !== "granted" || !gaId) return;
    if (window.gtag) {
      window.gtag("config", gaId, { page_path: pathname, anonymize_ip: true });
    }
  }, [pathname, consent, gaId]);

  // Consent-gated Meta funnel events.
  useEffect(() => {
    if (consent !== "granted" || !pixelId || !pixelReady) return;

    if (pathname === "/") {
      const eventId = createMetaEventId("landing");
      trackMetaPixelEvent("LandingPageView", { eventId });
      sendMetaConversion("LandingPageView", eventId);
    }

    const params = new URLSearchParams(window.location.search);
    const source = (params.get("utm_source") || "").toLowerCase();
    const medium = (params.get("utm_medium") || "").toLowerCase();
    const isIgAd =
      Boolean(params.get("fbclid")) ||
      source === "instagram" ||
      source === "ig" ||
      source === "fb" ||
      source === "facebook" ||
      source === "meta" ||
      medium === "paid_social";
    if (isIgAd) {
      const eventId = createMetaEventId("ig_ad");
      trackEvent("instagram_ad_landing", {
        event_id: eventId,
        utm_source: params.get("utm_source"),
        utm_campaign: params.get("utm_campaign"),
      });
      trackMetaPixelEvent("InstagramAdLanding", { eventId });
      sendMetaConversion("InstagramAdLanding", eventId);
    }
  }, [pathname, consent, pixelId, pixelReady]);

  const allowMarketingScripts = consent === "granted";

  return (
    <>
      {allowMarketingScripts && gaId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${gaId}', { anonymize_ip: true });
            `}
          </Script>
        </>
      ) : null}

      {allowMarketingScripts && pixelId ? (
        <Script id="meta-pixel" strategy="afterInteractive" onReady={() => setPixelReady(true)}>
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', ${JSON.stringify(pixelId)});
          `}
        </Script>
      ) : null}
    </>
  );
}
