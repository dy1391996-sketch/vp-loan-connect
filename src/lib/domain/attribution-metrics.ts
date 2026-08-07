import { prisma } from "@/lib/db";

export async function getChannelAttributionMetrics() {
  const [
    igComments,
    igDms,
    handoffsCreated,
    handoffsClicked,
    handoffsConsumed,
    commentToDm,
    handoffLeads,
  ] = await Promise.all([
    prisma.conversation.count({ where: { channel: "INSTAGRAM_COMMENT" } }),
    prisma.conversation.count({ where: { channel: "INSTAGRAM_DM" } }),
    prisma.channelHandoff.count(),
    prisma.channelHandoff.count({ where: { status: { in: ["CLICKED", "CONSUMED"] } } }),
    prisma.channelHandoff.count({ where: { status: "CONSUMED" } }),
    prisma.conversation.count({ where: { tags: { has: "comment_to_dm" } } }),
    prisma.channelHandoff.count({ where: { sourceLeadId: { not: null }, status: "CONSUMED" } }),
  ]);

  const bookingRequests = await prisma.lead.count({
    where: {
      source: { in: ["INSTAGRAM_DM", "INSTAGRAM_COMMENT"] },
      stage: { in: ["PAYMENT_LINK_SENT", "TOKEN_PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
    },
  });

  return {
    instagramCommentsReceived: igComments,
    instagramDmsReceived: igDms,
    commentToDmConversions: commentToDm,
    handoffsCreated,
    handoffsClicked,
    handoffsConsumed,
    handoffsResultingInLeads: handoffLeads,
    handoffsResultingInBookingRequests: bookingRequests,
  };
}
