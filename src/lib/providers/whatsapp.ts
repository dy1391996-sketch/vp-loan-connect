import { CommunicationDirection, CommunicationStatus, ConsentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { hasActiveConsent } from "@/lib/domain/consent";

export type WhatsAppTemplateKey = "ASSESSMENT_STARTED" | "INCOMPLETE_ASSESSMENT" | "FREE_RESULT_READY" | "PAYMENT_SUCCESS" | "REPORT_READY" | "OPT_OUT_CONFIRMATION";
type Purpose = "service" | "marketing";

export async function sendWhatsAppTemplate(leadId: string, templateKey: WhatsAppTemplateKey, parameters: Record<string, string>, purpose: Purpose = "service") {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { consentLogs: { orderBy: { createdAt: "desc" } } } });
  if (!lead) throw new Error("Lead not found.");
  const consentSnapshots = lead.consentLogs.map((log) => ({ type: log.consentType, accepted: log.accepted, withdrawnAt: log.withdrawnAt, createdAt: log.createdAt }));
  const permitted = purpose === "service" ? hasActiveConsent(consentSnapshots, ConsentType.SERVICE) : hasActiveConsent(consentSnapshots, ConsentType.MARKETING, lead.marketingOptedOutAt);
  if (!permitted) {
    return prisma.communicationLog.create({ data: { leadId, channel: "WHATSAPP", direction: CommunicationDirection.OUTBOUND, templateKey, purpose, status: CommunicationStatus.SKIPPED, failureReason: "No valid consent for message purpose" } });
  }

  const env = getServerEnv();
  let providerRef: string;
  if (env.WHATSAPP_PROVIDER === "mock") {
    if (env.NODE_ENV === "production") {
      throw new Error("WhatsApp mock provider is disabled in production. Set WHATSAPP_PROVIDER=meta with live credentials.");
    }
    providerRef = `mock-wa-${Date.now()}`;
  } else {
    if (!env.WHATSAPP_API_URL || !env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) throw new Error("WhatsApp provider is not configured.");
    const response = await fetch(`${env.WHATSAPP_API_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: lead.mobile.replace("+", ""), type: "template", template: { name: templateKey.toLowerCase(), language: { code: "hi" }, components: [{ type: "body", parameters: Object.values(parameters).map((text) => ({ type: "text", text })) }] } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("WhatsApp provider rejected the message.");
    const data = (await response.json()) as { messages?: Array<{ id: string }> };
    providerRef = data.messages?.[0]?.id ?? `meta-wa-${Date.now()}`;
  }
  return prisma.communicationLog.create({ data: { leadId, channel: "WHATSAPP", direction: CommunicationDirection.OUTBOUND, templateKey, purpose, providerRef, status: CommunicationStatus.SENT, sentAt: new Date(), messagePreview: JSON.stringify(parameters).slice(0, 500) } });
}
