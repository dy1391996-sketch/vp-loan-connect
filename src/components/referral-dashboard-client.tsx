"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { trackEvent } from "@/lib/analytics-client";

export function ReferralActions({ link }: { link: string }) { const [copied, setCopied] = useState(false); const message = `Loan apply करने से पहले अपनी income, EMI, credit health और documents check करें। Free profile preview उपलब्ध है। Detailed Credit Health Action Plan यहाँ देखें: ${link}. यह loan approval guarantee नहीं है।`; async function copy() { await navigator.clipboard.writeText(link); setCopied(true); trackEvent("referral_link_copied"); setTimeout(() => setCopied(false), 2000); } return <div className="mt-5 flex flex-col gap-3 sm:flex-row"><button onClick={copy} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-navy-950 px-5 text-sm font-bold text-white">{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? "Copied" : "Copy link"}</button><a onClick={() => trackEvent("whatsapp_share_clicked")} href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white"><MessageCircle size={17} />Share on WhatsApp</a></div>; }
