import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/env";
export default function robots():MetadataRoute.Robots{return{rules:[{userAgent:"*",allow:"/",disallow:["/admin/","/api/","/checkout","/payment/","/report/","/result/","/referral-dashboard","/consultation"]}],sitemap:`${getPublicAppUrl()}/sitemap.xml`};}
