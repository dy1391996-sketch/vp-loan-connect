import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, ShieldAlert } from "lucide-react";
import { BUSINESS_NAME } from "@/lib/constants";

export const metadata: Metadata = { title: "Contact Us" };

export default function ContactPage() {
  const email = process.env.SUPPORT_EMAIL || "support@vploanconnect.in";
  const whatsapp = process.env.SUPPORT_WHATSAPP;
  const address = process.env.BUSINESS_ADDRESS;
  const grievanceName = process.env.GRIEVANCE_NAME;
  const grievanceEmail = process.env.GRIEVANCE_EMAIL || email;

  return (
    <section className="min-h-[75vh] bg-surface py-14">
      <div className="page-shell">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Contact & support</p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-navy-950">We’re here to clarify the process</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">Never share UPI PIN, CVV, bank password or Aadhaar OTP with anyone claiming to represent VP Loan Connect.</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Card icon={Mail} title="Support email" value={email} href={`mailto:${email}`} />
            {whatsapp ? <Card icon={MessageCircle} title="WhatsApp support" value={whatsapp} href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} /> : null}
            <Card icon={MapPin} title="Legal business" value={BUSINESS_NAME} />
            {address ? <Card icon={MapPin} title="Business address" value={address} /> : null}
          </div>
          <div id="grievance" className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-7">
            <ShieldAlert className="text-amber-700" />
            <h2 className="mt-5 text-2xl font-bold text-amber-950">Grievance contact</h2>
            <p className="mt-3 text-sm leading-7 text-amber-950">
              {grievanceName ? `${grievanceName} is the designated grievance contact. ` : ""}
              Email <a className="font-bold underline" href={`mailto:${grievanceEmail}?subject=Grievance`}>{grievanceEmail}</a> with “Grievance” in the subject and include your registered mobile and order/reference where relevant.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Card({ icon: Icon, title, value, href }: { icon: typeof Mail; title: string; value: string; href?: string }) {
  const content = <><Icon className="text-brand-700" /><p className="mt-5 text-xs font-semibold text-slate-500">{title}</p><p className="mt-1 break-words font-bold text-navy-950">{value}</p></>;
  return href ? <a href={href} className="rounded-3xl border border-line bg-white p-6 shadow-card hover:border-brand-600">{content}</a> : <div className="rounded-3xl border border-line bg-white p-6 shadow-card">{content}</div>;
}
