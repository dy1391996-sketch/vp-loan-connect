import { createHash } from "node:crypto";
import { getServerEnv } from "@/lib/env";
import { isMetaFunnelEvent, metaPixelEventName, type MetaFunnelEvent } from "@/lib/meta/events";

export type CapIUserData = {
  email?: string | null;
  phone?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  externalId?: string | null;
};

export type CapIEventInput = {
  eventName: MetaFunnelEvent | string;
  eventId: string;
  eventSourceUrl?: string | null;
  actionSource?: "website";
  customData?: Record<string, string | number | boolean | null | undefined>;
  userData?: CapIUserData;
  testEventCode?: string | null;
};

function sha256Normalized(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function hashIfPresent(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return sha256Normalized(trimmed);
}

function normalizePhone(value: string): string {
  return value.replace(/\D+/g, "");
}

export function buildCapIUserData(user?: CapIUserData) {
  if (!user) return {};
  const phone = user.phone ? normalizePhone(user.phone) : "";
  return {
    ...(hashIfPresent(user.email) ? { em: [hashIfPresent(user.email)] } : {}),
    ...(phone ? { ph: [sha256Normalized(phone)] } : {}),
    ...(user.externalId ? { external_id: [sha256Normalized(user.externalId)] } : {}),
    ...(user.clientIpAddress ? { client_ip_address: user.clientIpAddress } : {}),
    ...(user.clientUserAgent ? { client_user_agent: user.clientUserAgent } : {}),
    ...(user.fbc ? { fbc: user.fbc } : {}),
    ...(user.fbp ? { fbp: user.fbp } : {}),
  };
}

export type CapIConfig = {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
  apiVersion?: string;
};

/** Read CAPI config from env. Missing vars → null (never throw; production must keep working). */
export function getMetaCapiConfig(environment: Record<string, string | undefined> = process.env): CapIConfig | null {
  const pixelId = String(environment.META_CAPI_PIXEL_ID || environment.NEXT_PUBLIC_META_PIXEL_ID || "").trim();
  const accessToken = String(environment.META_CAPI_ACCESS_TOKEN || "").trim();
  if (!pixelId || !accessToken) return null;
  const testEventCode = String(environment.META_TEST_EVENT_CODE || "").trim() || undefined;
  const apiVersion = String(environment.META_GRAPH_API_VERSION || "v22.0").trim() || "v22.0";
  return { pixelId, accessToken, testEventCode, apiVersion };
}

export function buildCapIPayload(input: CapIEventInput, config: CapIConfig) {
  const funnelName = isMetaFunnelEvent(input.eventName) ? input.eventName : null;
  const eventName = funnelName ? metaPixelEventName(funnelName) : String(input.eventName);
  const customData: Record<string, string | number> = {};
  if (input.customData) {
    for (const [key, value] of Object.entries(input.customData)) {
      if (value === null || value === undefined) continue;
      if (typeof value === "boolean") customData[key] = value ? 1 : 0;
      else customData[key] = value;
    }
  }
  // Always include our funnel name for custom reporting when mapped to a standard event.
  if (funnelName && eventName !== funnelName) customData.vplc_event = funnelName;

  return {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId.slice(0, 50),
        action_source: input.actionSource ?? "website",
        event_source_url: input.eventSourceUrl || undefined,
        user_data: buildCapIUserData(input.userData),
        ...(Object.keys(customData).length ? { custom_data: customData } : {}),
      },
    ],
    ...(input.testEventCode || config.testEventCode
      ? { test_event_code: input.testEventCode || config.testEventCode }
      : {}),
  };
}

export async function sendMetaCapiEvent(
  input: CapIEventInput,
  options?: { fetchImpl?: typeof fetch; environment?: NodeJS.ProcessEnv },
): Promise<{ sent: boolean; reason?: string; status?: number }> {
  const config = getMetaCapiConfig(options?.environment);
  if (!config) return { sent: false, reason: "not_configured" };

  // Never send without a stable event_id (dedupe requirement).
  if (!input.eventId?.trim()) return { sent: false, reason: "missing_event_id" };

  const payload = buildCapIPayload(input, config);
  const url = `https://graph.facebook.com/${config.apiVersion}/${encodeURIComponent(config.pixelId)}/events?access_token=${encodeURIComponent(config.accessToken)}`;
  const fetchImpl = options?.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      // Do not log response body (may contain sensitive diagnostics).
      console.error("meta_capi_rejected", response.status);
      return { sent: false, reason: "provider_rejected", status: response.status };
    }
    return { sent: true, status: response.status };
  } catch (error) {
    console.error("meta_capi_failed", error instanceof Error ? error.message : "unknown");
    return { sent: false, reason: "network_error" };
  }
}

/** Soft helper used by payment/assessment paths — never throws into business flows. */
export async function trackMetaConversionSafe(input: CapIEventInput) {
  try {
    // Touch env so misconfigured runtime still fails closed only for Meta, not the request.
    getServerEnv();
    return await sendMetaCapiEvent(input);
  } catch {
    return { sent: false, reason: "error" as const };
  }
}
