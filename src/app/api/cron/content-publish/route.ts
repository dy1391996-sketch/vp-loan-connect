import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { publishInstagramImage } from "@/lib/integrations/instagram/client";

function authorize(request: NextRequest) {
  return request.headers.get("authorization") === `Bearer ${getServerEnv().CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const due = await prisma.contentDraft.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: new Date() },
      OR: [{ requiresApproval: false }, { approvedAt: { not: null } }],
      sensitive: false,
    },
    take: 10,
  });

  const published = [];
  for (const draft of due) {
    if (draft.requiresApproval && !draft.approvedAt) continue;
    const media = "https://placehold.co/1080x1350/1c2836/f6f3ee/png?text=VP+Nest";
    const result = await publishInstagramImage(media, draft.caption ?? draft.hook ?? BRAND_CAPTION);
    const post = await prisma.socialPost.create({
      data: {
        draftId: draft.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
        caption: draft.caption,
        externalPostId: result.postId,
        mediaUrls: [media],
      },
    });
    await prisma.contentDraft.update({ where: { id: draft.id }, data: { status: "PUBLISHED" } });
    published.push(post.id);
  }

  return NextResponse.json({ published: published.length, ids: published });
}

const BRAND_CAPTION = "VP Nest – The Studio99Stay · Gaur City Center";
