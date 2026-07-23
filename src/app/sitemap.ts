import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/env";
export default function sitemap():MetadataRoute.Sitemap{const base=getPublicAppUrl();const paths=["","/assessment","/credit-health","/loan-readiness","/refer","/privacy","/terms","/refund-policy","/disclaimer","/consent-policy","/data-deletion","/contact"];return paths.map(path=>({url:`${base}${path}`,lastModified:new Date(),changeFrequency:path===""?"weekly":"monthly",priority:path===""?1:path==="/assessment"?0.9:0.6}));}
