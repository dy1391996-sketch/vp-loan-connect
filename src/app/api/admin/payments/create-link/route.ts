import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { generateBookingPaymentLink } from "@/lib/domain/bookings";
import { jsonData, parseJsonBody, routeError } from "@/lib/api/route-helpers";

const schema = z.object({ bookingId: z.string().min(1) });

export async function POST(request: NextRequest) {
  const authResult = await requireApiUser(request, "payments:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const input = await parseJsonBody(request, schema);
    const payment = await generateBookingPaymentLink(input.bookingId, authResult.auth.user.id);
    await writeAudit({ actorId: authResult.auth.user.id, action: "payment.createLink", entityType: "Payment", entityId: payment.id, after: payment });
    return jsonData(payment);
  } catch (error) {
    return routeError(error);
  }
}
