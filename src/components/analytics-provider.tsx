"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function AnalyticsProvider() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/") return;
    const payload = JSON.stringify({ eventName: "homepage_visit", page: pathname });
    navigator.sendBeacon?.("/api/analytics", new Blob([payload], { type: "application/json" }));
  }, [pathname]);
  return null;
}
