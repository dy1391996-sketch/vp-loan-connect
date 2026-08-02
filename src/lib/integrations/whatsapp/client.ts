import { getServerEnv } from "@/lib/env";
import { redactPii } from "@/lib/utils";

export type WhatsAppSendResult = { provider: "mock" | "meta"; messageId: string };

export async function sendWhatsAppText(toE164: string, body: string): Promise<WhatsAppSendResult> {
  const env = getServerEnv();
  const safeBody = body.slice(0, 4000);

  if (env.WHATSAPP_PROVIDER === "mock") {
    console.info("[whatsapp:mock]", redactPii(toE164), redactPii(safeBody).slice(0, 120));
    return { provider: "mock", messageId: `mock_wa_${crypto.randomUUID()}` };
  }

  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("WhatsApp Cloud API is not configured.");
  }

  const to = toE164.replace(/\D/g, "");
  const url = `${env.WHATSAPP_API_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body: safeBody },
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) throw new Error(`WhatsApp send failed (${response.status}).`);
  const data = (await response.json()) as { messages?: { id: string }[] };
  return { provider: "meta", messageId: data.messages?.[0]?.id ?? "unknown" };
}

export async function sendWhatsAppTemplate(input: {
  toE164: string;
  templateName: string;
  languageCode?: string;
  components?: unknown[];
}): Promise<WhatsAppSendResult> {
  const env = getServerEnv();
  if (env.WHATSAPP_PROVIDER === "mock") {
    return { provider: "mock", messageId: `mock_wa_tpl_${crypto.randomUUID()}` };
  }
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("WhatsApp Cloud API is not configured.");
  }
  const to = input.toE164.replace(/\D/g, "");
  const url = `${env.WHATSAPP_API_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode ?? "en" },
        components: input.components,
      },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`WhatsApp template send failed (${response.status}).`);
  const data = (await response.json()) as { messages?: { id: string }[] };
  return { provider: "meta", messageId: data.messages?.[0]?.id ?? "unknown" };
}
