import type { ChannelType } from "@prisma/client";

/** Normalized inbound event shared by WhatsApp + Instagram pipelines. */
export type NormalizedInboundEvent = {
  channel: ChannelType;
  externalEventId: string;
  externalMessageId: string;
  externalConversationId?: string;
  externalUserId: string;
  externalUsername?: string;
  externalParentId?: string;
  messageType: string;
  text?: string;
  media?: { id?: string; mimeType?: string; url?: string };
  timestamp?: string;
  replyTo?: string;
  sourceMetadata?: {
    mediaId?: string;
    commentId?: string;
    postId?: string;
    attributionPath?: string;
  };
  /** Sanitized subset only — never expose raw secrets */
  rawProviderMetadata?: Record<string, unknown>;
};

export function sanitizeProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : "Provider error";
  return message
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]")
    .replace(/access_token=[^&\s]+/gi, "access_token=[REDACTED]")
    .slice(0, 500);
}
