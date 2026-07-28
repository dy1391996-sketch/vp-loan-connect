import type { Metadata } from "next";
import { Building2, Headphones, Mail, MapPin, ShieldAlert } from "lucide-react";

export const metadata: Metadata = { title: "Contact Us", description: "Contact the VP Loan Connect support team for assessment, payment, report or privacy assistance." };

const PUBLIC_SUPPORT_EMAIL = "support@vploanconnect.in";

export default function ContactPage() {
  const businessName = process.env.BUSINESS_NAME;
  const address = process.env.BUSINESS_ADDRESS;

  return (
    <section className="surface-grid min-h-[75vh] bg-surface py-14 sm:py-20">
      <div className="page-shell">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">Contact & support</p>
            <h1 className="mt-4 text-balance text-4xl font-extrabold tracking-[-0.05em] text-navy-950 sm:text-5xl">Clear help, without pressure</h1>
            <p className="mt-5 text-base leading-8 text-slate-600">The Support Team can help with an assessment, payment, report, referral or privacy request. Never share a UPI PIN, CVV, bank password or Aadhaar OTP.</p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <Card icon={Mail} title="Support Email" value={PUBLIC_SUPPORT_EMAIL} href={`mailto:${PUBLIC_SUPPORT_EMAIL}`} />
            <Card icon={Headphones} title="Support Team" value="Assessment, payment, report and privacy assistance" />
            {businessName ? <Card icon={Building2} title="Business Name" value={businessName} /> : null}
            {address ? <Card icon={MapPin} title="Registered Office" value={address} /> : null}
          </div>

          <div id="grievance" className="mt-8 rounded-[2rem] border border-amber-200 bg-amber-50 p-7 sm:p-9">
            <ShieldAlert className="text-amber-700" size={28} />
            <h2 className="mt-5 text-2xl font-extrabold text-amber-950">Grievance Support Team</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-amber-950">
              Email <a className="font-bold underline underline-offset-4" href={`mailto:${PUBLIC_SUPPORT_EMAIL}?subject=Grievance`}>{PUBLIC_SUPPORT_EMAIL}</a> with “Grievance” in the subject and include your registered mobile and order or report reference where relevant.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Card({ icon: Icon, title, value, href }: { icon: typeof Mail; title: string; value: string; href?: string }) {
  const content = <><span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Icon size={21} /></span><p className="mt-6 text-xs font-semibold text-slate-500">{title}</p><p className="mt-1 break-words font-extrabold leading-7 text-navy-950">{value}</p></>;
  const className = "rounded-3xl border border-line bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:border-brand-500/50";
  return href ? <a href={href} className={className}>{content}</a> : <div className={className}>{content}</div>;
}
