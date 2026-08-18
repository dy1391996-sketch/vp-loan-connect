import type { CommentCategory } from "@prisma/client";
import { detectIntent } from "@/lib/ai/intent";
import type { NormalizedInboundEvent } from "@/lib/messaging/types";

export function classifyComment(text: string): CommentCategory {
  const { intent } = detectIntent(text);
  switch (intent) {
    case "booking_request":
      return "BOOKING_ENQUIRY";
    case "price_enquiry":
      return "PRICE_ENQUIRY";
    case "availability_enquiry":
      return "AVAILABILITY_ENQUIRY";
    case "location_request":
      return "LOCATION_ENQUIRY";
    case "complaint":
    case "refund_request":
      return "COMPLAINT";
    case "spam":
      return "SPAM";
    case "human_support":
      return "HUMAN_REQUEST";
    case "greeting":
      return "GENERAL";
    default:
      if (/abuse|idiot|scam|fraud/i.test(text)) return "ABUSIVE";
      return "OTHER";
  }
}

/** Parse Instagram Messaging webhook (Messenger Platform style) into normalized events. */
export function parseInstagramMessagingPayload(payload: unknown): NormalizedInboundEvent[] {
  const out: NormalizedInboundEvent[] = [];
  const root = payload as {
    object?: string;
    entry?: Array<{
      id?: string;
      time?: number;
      messaging?: Array<{
        sender?: { id?: string };
        recipient?: { id?: string };
        timestamp?: number;
        message?: {
          mid?: string;
          text?: string;
          reply_to?: { mid?: string };
          attachments?: Array<{ type?: string; payload?: { url?: string } }>;
        };
      }>;
    }>;
  };

  for (const entry of root.entry ?? []) {
    for (const item of entry.messaging ?? []) {
      const mid = item.message?.mid;
      const senderId = item.sender?.id;
      if (!mid || !senderId || senderId === entry.id) continue; // skip echo from page itself when possible
      const attachment = item.message?.attachments?.[0];
      out.push({
        channel: "INSTAGRAM_DM",
        externalEventId: mid,
        externalMessageId: mid,
        externalConversationId: senderId,
        externalUserId: senderId,
        messageType: attachment?.type ?? "text",
        text: item.message?.text,
        media: attachment ? { mimeType: attachment.type, url: attachment.payload?.url } : undefined,
        timestamp: item.timestamp ? String(item.timestamp) : undefined,
        replyTo: item.message?.reply_to?.mid,
        rawProviderMetadata: { entryId: entry.id },
      });
    }
  }
  return out;
}

/** Parse Instagram comment webhooks (page / Instagram changes). */
export function parseInstagramCommentPayload(payload: unknown): NormalizedInboundEvent[] {
  const out: NormalizedInboundEvent[] = [];
  const root = payload as {
    object?: string;
    entry?: Array<{
      id?: string;
      changes?: Array<{
        field?: string;
        value?: {
          id?: string;
          text?: string;
          from?: { id?: string; username?: string };
          media?: { id?: string };
          parent_id?: string;
          created_time?: number;
        };
      }>;
    }>;
  };

  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field && !/comment/i.test(change.field)) continue;
      const value = change.value;
      if (!value?.id || !value.from?.id) continue;
      out.push({
        channel: "INSTAGRAM_COMMENT",
        externalEventId: value.id,
        externalMessageId: value.id,
        externalConversationId: `comment:${value.media?.id ?? entry.id}:${value.from.id}`,
        externalUserId: value.from.id,
        externalUsername: value.from.username,
        externalParentId: value.parent_id,
        messageType: "comment",
        text: value.text,
        timestamp: value.created_time ? String(value.created_time) : undefined,
        sourceMetadata: {
          mediaId: value.media?.id,
          commentId: value.id,
          postId: value.media?.id,
        },
        rawProviderMetadata: { field: change.field, entryId: entry.id },
      });
    }
  }
  return out;
}
