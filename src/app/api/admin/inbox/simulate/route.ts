import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { processWhatsAppInboundMessage } from "@/lib/whatsapp/inbound";
import { jsonData, parseJsonBody, routeError } from "@/lib/api/route-helpers";
import { jsonError } from "@/lib/auth/api";
import { getServerEnv } from "@/lib/env";

/** Local/sandbox helper to simulate an inbound WhatsApp message without Meta. */
const schema = z.object({
  from: z.string().min(10),
  text: z.string().min(1),
  profileName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireApiUser(request, "inbox:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const env = getServerEnv();
    if (env.NODE_ENV === "production" && env.WHATSAPP_PROVIDER !== "mock") {
      return jsonError("Simulate endpoint disabled in live production.", 403);
    }
    const input = await parseJsonBody(request, schema);
    const result = await processWhatsAppInboundMessage({
      waMessageId: `sim_${crypto.randomUUID()}`,
      from: input.from.replace(/\D/g, ""),
      profileName: input.profileName ?? "Simulated Guest",
      type: "text",
      text: input.text,
      timestamp: String(Math.floor(Date.now() / 1000)),
    });
    return jsonData(result, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
