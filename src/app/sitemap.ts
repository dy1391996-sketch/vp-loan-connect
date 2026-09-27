import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/env";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getPublicAppUrl();
  const paths = [
    "",
    "/apply/quick",
    "/loan-assistance",
    "/personal-loan",
    "/assessment",
    "/credit-health",
    "/refer",
    "/privacy",
    "/terms",
    "/refund-policy",
    "/disclaimer",
    "/consent-policy",
    "/data-deletion",
    "/contact",
    "/about",
  ];
  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/assessment" || path === "/personal-loan" || path === "/apply/quick" || path === "/loan-assistance" ? 0.9 : 0.6,
  }));
}
