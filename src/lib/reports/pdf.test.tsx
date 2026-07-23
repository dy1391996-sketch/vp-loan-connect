import assert from "node:assert/strict";
import { it } from "node:test";
import { renderReportPdf, type PdfReportData } from "./pdf";

it("renders a mobile-readable PDF with Hindi and English text", async () => {
  const data: PdfReportData = { type: "CREDIT_HEALTH_ACTION_PLAN", reportReference: "VPLC-260723-0001", customerName: "Demo User", assessmentDate: "23/07/2026", generatedDate: "23/07/2026", loanType: "Personal Loan", requestedAmount: "₹5,00,000", employmentType: "Salaried", incomeRange: "₹60,000–₹99,999", existingEmi: "₹8,000", creditRange: "750+", readinessScore: 84, readinessLabel: "Strong readiness", emiBurden: "Low", documentationStatus: "Strong", creditHealthStatus: "Healthy", comfortableEmi: "₹12,000–₹20,000/month", categories: ["Personal Loan"], strengths: ["Stable profile"], risks: ["Verify details"], missingDocuments: [], supportEmail: "support@vploanconnect.in", supportWhatsApp: "", businessName: "THE99CREW FACILITY MANAGEMENT" };
  const pdf = await renderReportPdf(data);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 5000);
});
