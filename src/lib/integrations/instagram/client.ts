import { getServerEnv } from "@/lib/env";
import { sanitizeProviderError } from "@/lib/messaging/types";

export type InstagramSendResult = {
  ok: boolean;
  provider: "mock" | "meta";
  messageId?: string;
  status: "SENT" | "SKIPPED_PROVIDER_UNAVAILABLE" | "FAILED";
  error?: string;
  missing?: string[];
};

function credentials() {
  const env = getServerEnv();
  // Prefer Instagram-specific token; allow META_ACCESS_TOKEN alias without requiring it
  const token = env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || "";
  const igUserId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "";
  const pageId = env.INSTAGRAM_PAGE_ID || process.env.FACEBOOK_PAGE_ID || "";
  return { env, token, igUserId, pageId };
}

export function instagramProviderAvailability() {
  const { env, token, igUserId } = credentials();
  if (env.INSTAGRAM_PROVIDER === "mock") {
    return { available: true as const, mode: "mock" as const, missing: [] as string[] };
  }
  const missing: string[] = [];
  if (!token) missing.push("INSTAGRAM_ACCESS_TOKEN|META_ACCESS_TOKEN");
  if (!igUserId) missing.push("INSTAGRAM_BUSINESS_ACCOUNT_ID");
  return { available: missing.length === 0, mode: "meta" as const, missing };
}

export async function sendInstagramText(igScopedId: string, text: string): Promise<InstagramSendResult> {
  const avail = instagramProviderAvailability();
  if (!avail.available) {
    return {
      ok: false,
      provider: "meta",
      status: "SKIPPED_PROVIDER_UNAVAILABLE",
      missing: avail.missing,
      error: `Instagram send unavailable. Missing: ${avail.missing.join(", ")}`,
    };
  }

  const { env, token, igUserId } = credentials();
  if (env.INSTAGRAM_PROVIDER === "mock") {
    return { ok: true, provider: "mock", messageId: `mock_ig_${crypto.randomUUID()}`, status: "SENT" };
  }

  try {
    const url = `https://graph.facebook.com/v22.0/${igUserId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: igScopedId },
        message: { text: text.slice(0, 1000) },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        provider: "meta",
        status: "FAILED",
        error: sanitizeProviderError(`Instagram send failed (${response.status})`),
      };
    }
    const data = (await response.json()) as { message_id?: string };
    return { ok: true, provider: "meta", messageId: data.message_id ?? "unknown", status: "SENT" };
  } catch (error) {
    return { ok: false, provider: "meta", status: "FAILED", error: sanitizeProviderError(error) };
  }
}

/** Private reply to an Instagram comment (requires instagram_manage_comments + messaging permissions). */
export async function privateReplyToComment(commentId: string, text: string): Promise<InstagramSendResult> {
  const avail = instagramProviderAvailability();
  if (!avail.available) {
    return {
      ok: false,
      provider: "meta",
      status: "SKIPPED_PROVIDER_UNAVAILABLE",
      missing: [...avail.missing, "instagram_manage_comments?"],
      error: "Private reply unavailable — Instagram credentials/permissions missing.",
    };
  }
  const { env, token } = credentials();
  if (env.INSTAGRAM_PROVIDER === "mock") {
    return { ok: true, provider: "mock", messageId: `mock_ig_priv_${crypto.randomUUID()}`, status: "SENT" };
  }
  try {
    const url = `https://graph.facebook.com/v22.0/${commentId}/private_replies`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: text.slice(0, 1000) }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        provider: "meta",
        status: "FAILED",
        error: sanitizeProviderError(`Private reply failed (${response.status})`),
        missing: response.status === 403 || response.status === 400 ? ["instagram_manage_comments|private_replies"] : undefined,
      };
    }
    const data = (await response.json()) as { id?: string };
    return { ok: true, provider: "meta", messageId: data.id ?? "unknown", status: "SENT" };
  } catch (error) {
    return { ok: false, provider: "meta", status: "FAILED", error: sanitizeProviderError(error) };
  }
}

export async function publicReplyToComment(commentId: string, text: string): Promise<InstagramSendResult> {
  const avail = instagramProviderAvailability();
  if (!avail.available) {
    return {
      ok: false,
      provider: "meta",
      status: "SKIPPED_PROVIDER_UNAVAILABLE",
      missing: avail.missing,
      error: "Public comment reply unavailable — Instagram credentials missing.",
    };
  }
  const { env, token } = credentials();
  if (env.INSTAGRAM_PROVIDER === "mock") {
    return { ok: true, provider: "mock", messageId: `mock_ig_pub_${crypto.randomUUID()}`, status: "SENT" };
  }
  try {
    const url = `https://graph.facebook.com/v22.0/${commentId}/replies`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: text.slice(0, 300) }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      return { ok: false, provider: "meta", status: "FAILED", error: sanitizeProviderError(`Public reply failed (${response.status})`) };
    }
    const data = (await response.json()) as { id?: string };
    return { ok: true, provider: "meta", messageId: data.id ?? "unknown", status: "SENT" };
  } catch (error) {
    return { ok: false, provider: "meta", status: "FAILED", error: sanitizeProviderError(error) };
  }
}

export async function publishInstagramImage(imageUrl: string, caption: string) {
  const avail = instagramProviderAvailability();
  if (!avail.available) {
    return { provider: "meta" as const, postId: undefined, status: "SKIPPED_PROVIDER_UNAVAILABLE" as const, missing: avail.missing };
  }
  const { env, token, igUserId } = credentials();
  if (env.INSTAGRAM_PROVIDER === "mock") {
    return { provider: "mock" as const, postId: `mock_post_${crypto.randomUUID()}`, status: "SENT" as const };
  }
  const containerRes = await fetch(
    `https://graph.facebook.com/v22.0/${igUserId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${token}`,
    { method: "POST", signal: AbortSignal.timeout(20_000) },
  );
  if (!containerRes.ok) throw new Error(sanitizeProviderError(`Instagram media container failed (${containerRes.status}).`));
  const container = (await containerRes.json()) as { id: string };
  const publishRes = await fetch(
    `https://graph.facebook.com/v22.0/${igUserId}/media_publish?creation_id=${container.id}&access_token=${token}`,
    { method: "POST", signal: AbortSignal.timeout(20_000) },
  );
  if (!publishRes.ok) throw new Error(sanitizeProviderError(`Instagram publish failed (${publishRes.status}).`));
  const published = (await publishRes.json()) as { id: string };
  return { provider: "meta" as const, postId: published.id, status: "SENT" as const };
}
