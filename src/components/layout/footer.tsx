import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { PLATFORM_DISCLAIMER, TAGLINE } from "@/lib/constants";

const legal = [["Privacy Policy", "/privacy"], ["Terms & Conditions", "/terms"], ["Refund Policy", "/refund-policy"], ["Disclaimer", "/disclaimer"], ["Consent Policy", "/consent-policy"], ["Data deletion", "/data-deletion"]];

export function Footer() {
  const email = process.env.SUPPORT_EMAIL || "support@vploanconnect.in";
  const whatsapp = process.env.SUPPORT_WHATSAPP;
  const businessName = process.env.BUSINESS_NAME;
  return (
    <footer className="bg-navy-950 text-white">
      <div className="page-shell grid gap-12 py-16 md:grid-cols-2 xl:grid-cols-[1.35fr_0.65fr_0.8fr_0.8fr]">
        <div className="max-w-xl">
          <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500 text-sm font-black tracking-[-0.08em] text-navy-950">VP</span><div><p className="font-extrabold">VP Loan Connect</p><p className="text-xs text-slate-400">{TAGLINE}</p></div></div>
          <p className="mt-6 text-sm leading-7 text-slate-300">{PLATFORM_DISCLAIMER}</p>
        </div>
        <div><p className="font-bold">Explore</p><div className="mt-4 grid gap-1">{[["Free assessment", "/assessment"], ["Credit health", "/credit-health"], ["Loan readiness", "/loan-readiness"], ["Refer & Earn", "/refer"]].map(([label, href]) => <Link key={href} href={href} className="inline-flex min-h-11 items-center text-sm text-slate-300 transition hover:text-white">{label}</Link>)}</div></div>
        <div><p className="font-bold">Policies</p><div className="mt-4 grid gap-1">{legal.map(([label, href]) => <Link key={href} href={href} className="inline-flex min-h-11 items-center text-sm text-slate-300 transition hover:text-white">{label}</Link>)}</div></div>
        <div><p className="font-bold">Support</p><div className="mt-4 grid gap-1 text-sm text-slate-300"><Link href="/contact" className="inline-flex min-h-11 items-center hover:text-white">Contact us</Link><Link href="/contact#grievance" className="inline-flex min-h-11 items-center hover:text-white">Grievance contact</Link><a href={`mailto:${email}`} className="flex min-h-11 items-center gap-2 hover:text-white"><Mail size={15} />{email}</a>{whatsapp ? <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="flex min-h-11 items-center gap-2 hover:text-white"><MessageCircle size={15} />WhatsApp support</a> : null}</div></div>
      </div>
      <div className="border-t border-white/10"><div className="page-shell flex flex-col gap-2 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} VP Loan Connect{businessName ? ` • Operated by ${businessName}` : ""}</p><p>Secure profile assessment • vploanconnect.in</p></div></div>
    </footer>
  );
}
