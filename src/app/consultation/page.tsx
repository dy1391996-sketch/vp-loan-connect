import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { ConsultationForm } from "@/components/consultation-form";
import { PublicStatePanel } from "@/components/ui/public-state-panel";
import { verifyAccessToken } from "@/lib/security/tokens";

export const dynamic = "force-dynamic"; export const metadata: Metadata = { title: "Consultation Request", robots: { index: false, follow: false } };
export default async function ConsultationPage({ searchParams }: { searchParams: Promise<{ assessment?: string; token?: string }> }) { const q = await searchParams; if (!q.assessment || !q.token) return <Restricted />; try { const payload = await verifyAccessToken(q.token, "result_access"); if (payload.sub !== q.assessment) throw new Error("mismatch"); } catch { return <Restricted />; } return <section className="surface-grid min-h-[75vh] bg-surface py-14 sm:py-18"><div className="page-shell"><div className="mx-auto max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">15-minute guidance consultation</p><h1 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] text-navy-950 sm:text-4xl">Consultation request</h1><p className="mt-4 mb-8 text-sm leading-7 text-slate-600">Educational guidance only. This is not a lender call and does not guarantee approval.</p><ConsultationForm assessmentId={q.assessment} token={q.token} /></div></div></section>; }
function Restricted() { return <PublicStatePanel icon={MessageCircle} eyebrow="Consultation access" title="Secure assessment link required" description="Open the consultation request from your verified assessment result." action={{ href: "/assessment", label: "Start free assessment" }} />; }
