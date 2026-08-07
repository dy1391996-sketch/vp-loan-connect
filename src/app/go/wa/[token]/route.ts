import { NextRequest, NextResponse } from "next/server";
import {
  buildWhatsAppClickToChatUrl,
  findHandoffByRawToken,
  markHandoffClicked,
  supportWhatsAppDigits,
} from "@/lib/domain/handoff";
import { rateLimit, clientIp } from "@/lib/security/request";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const ip = clientIp(request);
  const limited = rateLimit(`handoff:${ip}`, 60, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const { token } = await context.params;
  // Opaque token only — reject path traversal / open redirect attempts
  if (!token || token.includes("/") || token.includes("..") || token.length > 128) {
    return NextResponse.json({ error: "Invalid handoff token." }, { status: 400 });
  }

  const handoff = await findHandoffByRawToken(token);
  if (!handoff) return NextResponse.json({ error: "Invalid or unknown handoff link." }, { status: 404 });
  if (handoff.expiresAt < new Date() || handoff.status === "EXPIRED" || handoff.status === "CANCELLED") {
    return NextResponse.json({ error: "This handoff link has expired." }, { status: 410 });
  }

  await markHandoffClicked(handoff.id);
  const prefilled = `Hi, I'm continuing my Studio99Stay enquiry. Ref: ${handoff.publicRef}`;
  const waUrl = buildWhatsAppClickToChatUrl(supportWhatsAppDigits(), prefilled);
  if (!waUrl.startsWith("https://wa.me/")) {
    return NextResponse.json({ error: "Unsafe redirect blocked." }, { status: 500 });
  }
  return NextResponse.redirect(waUrl, 302);
}
