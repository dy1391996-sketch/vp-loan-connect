import { getPublicInstagramUrl } from "@/lib/public-contact";

export type PublicSiteConfig = {
  instagramUrl: string;
  metaPixelId: string;
  gaMeasurementId: string;
  /** True when server CAPI token + pixel id are both configured (never exposes the token). */
  metaCapiConfigured: boolean;
};

/** Public, non-secret site config readable at request time (safe for browser). */
export function getPublicSiteConfig(environment: Record<string, string | undefined> = process.env): PublicSiteConfig {
  const metaPixelId = String(environment.NEXT_PUBLIC_META_PIXEL_ID || environment.META_CAPI_PIXEL_ID || "").trim();
  const gaMeasurementId = String(environment.NEXT_PUBLIC_GA_MEASUREMENT_ID || environment.NEXT_PUBLIC_ANALYTICS_ID || "").trim();
  const token = String(environment.META_CAPI_ACCESS_TOKEN || "").trim();
  const capiPixel = String(environment.META_CAPI_PIXEL_ID || environment.NEXT_PUBLIC_META_PIXEL_ID || "").trim();
  return {
    instagramUrl: getPublicInstagramUrl(environment),
    metaPixelId,
    gaMeasurementId,
    metaCapiConfigured: Boolean(token && capiPixel),
  };
}
