import Link from "next/link";
import { BarChart3, FileText, Landmark, LayoutDashboard, Megaphone, Settings, UsersRound, WalletCards, Waypoints } from "lucide-react";
import { LogoutButton } from "./logout-button";

const links = [
  ["Overview", "/admin", LayoutDashboard],\n  ["Marketing", "/admin/marketing", Megaphone],
  ["Leads", "/admin/leads", UsersRound],
  ["Payments", "/admin/payments", WalletCards],
  ["Reports", "/admin/reports", FileText],
  ["Lenders", "/admin/lenders", Landmark],
  ["Referrals", "/admin/referrals", Waypoints],
  ["Settings", "/admin/settings", Settings],
] as const;

export function AdminShell({ title, description, adminName, children }: { title: string; description?: string; adminName: string; children: React.ReactNode }) {
  return <section className="min-h-screen bg-surface"><div className="page-shell py-8"><div className="mb-6 flex flex-col gap-4 rounded-2xl bg-navy-950 p-5 text-white lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-navy-950"><BarChart3 size={20} /></span><div><p className="text-xs text-slate-400">Secure operations</p><p className="font-bold">VP Loan Connect Admin</p></div></div><div className="flex items-center gap-3 text-sm"><span className="text-slate-300">{adminName}</span><LogoutButton /></div></div><nav className="mb-7 flex gap-2 overflow-x-auto pb-2" aria-label="Admin navigation">{links.map(([label, href, Icon]) => <Link key={href} href={href} className="flex shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:border-brand-600"><Icon size={16} />{label}</Link>)}</nav><div className="mb-7"><h1 className="text-3xl font-bold tracking-[-0.04em] text-navy-950">{title}</h1>{description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}</div>{children}</div></section>;
}
