import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendWhatsAppTemplate } from "@/lib/providers/whatsapp";
import { getPdfReportData } from "@/lib/reports/report-data";
import { renderReportPdf } from "@/lib/reports/pdf";
import { verifyAccessToken } from "@/lib/security/tokens";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Secure report token required." }, { status: 401 });

  let access;
  try {
    access = await verifyAccessToken(token, "report_access");
    if (access.sub !== id) throw new Error("Token mismatch");
  } catch {
    return NextResponse.json({ error: "Report link is invalid or expired." }, { status: 401 });
  }

  const authorizedReport = await prisma.report.findUnique({ where: { id }, include: { order: true } });
  if (
    !authorizedReport
    || authorizedReport.order.status !== "PAID"
    || access.leadId !== authorizedReport.leadId
    || access.orderId !== authorizedReport.orderId
  ) return NextResponse.json({ error: "Paid report is unavailable." }, { status: 404 });

  const data = await getPdfReportData(id);
  if (!data) return NextResponse.json({ error: "Paid report is unavailable." }, { status: 404 });

  try {
    await prisma.report.update({ where: { id }, data: { status: "PROCESSING" } });
    const buffer = await renderReportPdf(data);
    const report = await prisma.report.update({ where: { id }, data: { status: "DELIVERED", generatedAt: new Date(), deliveredAt: new Date() } });
    await prisma.lead.update({ where: { id: report.leadId }, data: { stage: "REPORT_DELIVERED" } });
    sendWhatsAppTemplate(report.leadId, "REPORT_READY", { link: request.url }).catch(() => undefined);
    await prisma.analyticsEvent.create({ data: { leadId: report.leadId, eventName: "report_downloaded", page: `/report/${id}` } }).catch(() => undefined);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${data.reportReference}.pdf"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    await prisma.report.update({ where: { id }, data: { status: "FAILED", failureReason: error instanceof Error ? error.message.slice(0, 500) : "PDF generation failed" } });
    return NextResponse.json({ error: "Report generation failed. Please retry or contact support." }, { status: 500 });
  }
}
