import { NextResponse } from "next/server";
import { getPublicSiteConfig } from "@/lib/public-site-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Public non-secret config for browser hydration (Instagram URL, Pixel ID). Never returns tokens. */
export async function GET() {
  const config = getPublicSiteConfig();
  return NextResponse.json(
    {
      instagramUrl: config.instagramUrl,
      metaPixelId: config.metaPixelId,
      gaMeasurementId: config.gaMeasurementId,
      metaCapiConfigured: config.metaCapiConfigured,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
