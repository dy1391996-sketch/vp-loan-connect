import { NextRequest, NextResponse } from "next/server";
import { MARKETING_CONSENT_COOKIE } from "@/lib/consent/marketing-consent";
import { prismaEnquiryStore } from "@/lib/loan-assistance/prisma-store";
import { createLoanAssistanceEnquiry, shouldEmitLoanAssistanceLead } from "@/lib/loan-assistance/service";
import { validateLoanAssistanceInput } from "@/lib/loan-assistance/validation";
import { trackMetaConversionSafe } from "@/lib/meta/capi";
import { assertSameOrigin, rateLimit, requestIp, requestIpHash } from "@/lib/security/request";
import { sha256 } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientAddress(request: NextRequest): string | null {
  return requestIp(request) ?? null;
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ error: "Reload this page and submit the form again." }, { status: 403 });
  }

  const ipHash = requestIpHash(request) ?? "unknown";
  if (!rateLimit(`loan-assistance-ip:${ipHash}`, 8, 60 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = validateLoanAssistanceInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, fields: parsed.fields ?? null }, { status: parsed.status });
  }

  const mobileHash = sha256(parsed.data.mobile);
  if (!rateLimit(`loan-assistance-mobile:${mobileHash}`, 4, 24 * 60 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Too many attempts for this mobile number. Please try again later." }, { status: 429 });
  }

  const marketingConsentGranted = request.cookies.get(MARKETING_CONSENT_COOKIE)?.value === "granted";

  try {
    const result = await createLoanAssistanceEnquiry({
      draft: parsed.data,
      store: prismaEnquiryStore,
      marketingConsentGranted,
    });

    if (shouldEmitLoanAssistanceLead(result, marketingConsentGranted && parsed.data.marketingConsent) && result.eventId) {
      await trackMetaConversionSafe({
        eventName: "LoanAssistanceEnquiry",
        eventId: result.eventId,
        eventSourceUrl: parsed.data.pageUrl,
        customData: {
          content_category: parsed.data.loanType,
          lead_source: parsed.data.source,
        },
        userData: {
          phone: parsed.data.mobile,
          externalId: mobileHash,
          clientIpAddress: clientAddress(request),
          clientUserAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
          fbp: parsed.data.fbp,
          fbc: parsed.data.fbc,
        },
      });
    }

    return NextResponse.json(
      {
        status: result.status,
        reference: result.reference,
        eventId: result.eventId,
        isTest: result.isTest,
      },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("loan_assistance_enquiry_failed", message === "INVALID_ORIGIN" ? message : "server_error");
    return NextResponse.json({ error: "We could not save this enquiry. Please try again." }, { status: 500 });
  }
}
