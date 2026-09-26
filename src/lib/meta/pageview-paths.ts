/** Paths that may send one consent-gated PageView. Lead is never sent from a page view. */
export const CONSENT_PAGEVIEW_PATHS = ["/", "/loan-assistance"] as const;

export function isConsentPageViewPath(pathname: string): boolean {
  return (CONSENT_PAGEVIEW_PATHS as readonly string[]).includes(pathname);
}