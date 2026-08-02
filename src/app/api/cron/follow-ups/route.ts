import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { sendWhatsAppTemplate } from "@/lib/integrations/whatsapp/client";

function authorize(request: NextRequest) {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${getServerEnv().CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const due = await prisma.followUp.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    include: { customer: true },
    take: 50,
  });

  let sent = 0;
  for (const item of due) {
    if (item.customer.optedOut) {
      await prisma.followUp.update({
        where: { id: item.id },
        data: { status: "SKIPPED", cancelReason: "opted_out" },
      });
      continue;
    }
    if (item.attempt >= item.maxAttempts) {
      await prisma.followUp.update({
        where: { id: item.id },
        data: { status: "SKIPPED", cancelReason: "max_attempts" },
      });
      continue;
    }
    try {
      if (item.channel === "WHATSAPP" && item.customer.phone && item.templateKey) {
        await sendWhatsAppTemplate({
          toE164: item.customer.phone,
          templateName: item.templateKey,
        });
      }
      await prisma.followUp.update({
        where: { id: item.id },
        data: { status: "SENT", sentAt: new Date(), attempt: { increment: 1 } },
      });
      sent += 1;
    } catch {
      await prisma.followUp.update({
        where: { id: item.id },
        data: { status: "FAILED", attempt: { increment: 1 } },
      });
    }
  }

  return NextResponse.json({ processed: due.length, sent });
}
