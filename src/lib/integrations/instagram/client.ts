import { getServerEnv } from "@/lib/env";

/** Instagram Messaging + Content Publishing adapters (official Graph API only). */
export async function sendInstagramText(igScopedId: string, text: string) {
  const env = getServerEnv();
  if (env.INSTAGRAM_PROVIDER === "mock") {
    return { provider: "mock" as const, messageId: `mock_ig_${crypto.randomUUID()}` };
  }
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    throw new Error("Instagram API is not configured.");
  }
  const url = `https://graph.facebook.com/v22.0/${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.INSTAGRAM_ACCESS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: igScopedId },
      message: { text: text.slice(0, 1000) },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Instagram send failed (${response.status}).`);
  const data = (await response.json()) as { message_id?: string };
  return { provider: "meta" as const, messageId: data.message_id ?? "unknown" };
}

export async function publishInstagramImage(imageUrl: string, caption: string) {
  const env = getServerEnv();
  if (env.INSTAGRAM_PROVIDER === "mock") {
    return { provider: "mock" as const, postId: `mock_post_${crypto.randomUUID()}` };
  }
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    throw new Error("Instagram publishing is not configured.");
  }
  const igUser = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const token = env.INSTAGRAM_ACCESS_TOKEN;

  const containerRes = await fetch(
    `https://graph.facebook.com/v22.0/${igUser}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${token}`,
    { method: "POST", signal: AbortSignal.timeout(20_000) },
  );
  if (!containerRes.ok) throw new Error(`Instagram media container failed (${containerRes.status}).`);
  const container = (await containerRes.json()) as { id: string };

  const publishRes = await fetch(
    `https://graph.facebook.com/v22.0/${igUser}/media_publish?creation_id=${container.id}&access_token=${token}`,
    { method: "POST", signal: AbortSignal.timeout(20_000) },
  );
  if (!publishRes.ok) throw new Error(`Instagram publish failed (${publishRes.status}).`);
  const published = (await publishRes.json()) as { id: string };
  return { provider: "meta" as const, postId: published.id };
}
