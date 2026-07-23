import type { Metadata } from "next";
import { ProductPage } from "@/components/product/product-page";

export const metadata: Metadata = { title: "Credit Health Action Plan", description: "Personalized educational credit-health observations and an action plan. No score-improvement guarantee." };

export default function CreditHealthPage() {
  return <ProductPage kind="credit" title="VP Credit Health Action Plan" heading="जानिए आपकी Credit Profile में सबसे पहले क्या सुधार करना चाहिए" description="Credit-risk factors, EMI burden, utilization, overdue और official dispute-process guidance को एक practical roadmap में समझें." regular="₹199 + GST" price="Launch price ₹99 + 18% GST" total="₹116.82 total" badge="Educational action plan • No bureau affiliation" deliverables={["Personalized credit-health summary", "Credit-risk factors", "EMI burden analysis", "Credit utilization guidance", "Overdue, DPD, settled and written-off explanation", "Unrecognized enquiry review checklist", "Official dispute-process guidance", "30-day action plan", "90-day improvement roadmap", "Branded downloadable PDF", "WhatsApp support instructions"]} />;
}
