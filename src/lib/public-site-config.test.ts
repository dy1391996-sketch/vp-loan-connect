import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPublicSiteConfig } from "@/lib/public-site-config";

describe("public site config", () => {
  it("exposes only public fields and never requires CAPI token for Instagram", () => {
    const config = getPublicSiteConfig({
      NEXT_PUBLIC_INSTAGRAM_URL: "https://www.instagram.com/vploanconnect/",
      NEXT_PUBLIC_META_PIXEL_ID: "pixel-public",
    });
    assert.equal(config.instagramUrl, "https://www.instagram.com/vploanconnect/");
    assert.equal(config.metaPixelId, "pixel-public");
    assert.equal(config.metaCapiConfigured, false);
  });

  it("marks CAPI configured only when token and pixel id are both present", () => {
    const config = getPublicSiteConfig({
      NEXT_PUBLIC_META_PIXEL_ID: "pixel-public",
      META_CAPI_ACCESS_TOKEN: "token",
    });
    assert.equal(config.metaCapiConfigured, true);
  });
});
