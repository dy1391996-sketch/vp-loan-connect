import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { rateLimit, requestIpHash } from "@/lib/security/request";
import { canExportLeads } from "@/lib/admin/permissions";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const { admin } = await requireAdmin(["SUPER_ADMIN", "ADMIN"]);
  if (!canExportLeads(admin.role)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const ipHash = requestIpHash(request) ?? "unknown";
  if (
    !rateLimit(`admin-export-leads:${admin.id}`, 6, 60 * 60 * 1000).allowed ||
    !rateLimit(`admin-export-leads-ip:${ipHash}`, 12, 60 * 60 * 1000).allowed
  ) {
    return NextResponse.json({ error: "Too many exports. Please wait before trying again." }, { status: 429 });
  }

  const leads = await prisma.lead.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      mobile: true,
      state: true,
      city: true,
      stage: true,
      source: true,
      referralCode: true,
      referredByCode: true,
      mobileVerifiedAt: true,
      mobileVerificationMethod: true,
      marketingOptedOutAt: true,
      createdAt: true,
    },
  });
  const headers = [
    "id",
    "full_name",
    "mobile",
    "state",
    "city",
    "stage",
    "source",
    "referral_code",
    "referred_by",
    "mobile_verified_at",
    "mobile_verification_method",
    "marketing_opted_out_at",
    "created_at",
  ];
  const rows = leads.map((lead) =>
    [
      lead.id,
      lead.fullName,
      lead.mobile,
      lead.state,
      lead.city,
      lead.stage,
      lead.source,
      lead.referralCode,
      lead.referredByCode,
      lead.mobileVerifiedAt?.toISOString(),
      lead.mobileVerificationMethod,
      lead.marketingOptedOutAt?.toISOString(),
      lead.createdAt.toISOString(),
    ]
      .map(csvCell)
      .join(","),
  );
  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: "LEADS_CSV_EXPORT",
      entityType: "Lead",
      metadata: { count: leads.length },
      ipHash: requestIpHash(request),
      userAgent: request.headers.get("user-agent")?.slice(0, 500),
    },
  });
  return new NextResponse([headers.map(csvCell).join(","), ...rows].join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="vp-loan-connect-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
