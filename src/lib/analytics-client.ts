export function trackEvent(eventName: string, properties?: Record<string, string | number | boolean | null>) {
  const payload = JSON.stringify({ eventName, page: window.location.pathname, properties });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/analytics", new Blob([payload], { type: "application/json" }));
  else fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => undefined);
}
