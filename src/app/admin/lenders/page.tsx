import { BadgeCheck, Landmark } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { parseProductRules } from "@/lib/matching/profile-match";

export const dynamic = "force-dynamic";

export default async function AdminLendersPage() {
  const { admin } = await requireAdmin(["SUPER_ADMIN", "ADMIN", "SUPPORT"]);
  const lenders = await prisma.lender.findMany({
    include: { products: { orderBy: { createdAt: "asc" } } },
    orderBy: { displayName: "asc" },
  });

  return (
    <AdminShell
      title="Lender matching"
      description="Active verified products feed the Credit Profile Booster ranking engine. Official apply URLs live in product eligibility rules."
      adminName={admin.fullName}
    >
      <div className="mb-5 rounded-2xl border border-line bg-white p-5 text-sm leading-7 text-slate-600">
        Matching uses only lenders marked <strong>active + verified + productDetailsApproved</strong> with at least one active product.
        Re-run <code className="rounded bg-surface px-1.5 py-0.5 text-xs">pnpm db:seed</code> to refresh the public catalog.
      </div>

      <div className="grid gap-4">
        {lenders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-slate-600">
            No lenders seeded yet. Run <code>pnpm db:seed</code>.
          </div>
        ) : (
          lenders.map((lender) => (
            <article key={lender.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-700"><Landmark size={20} /></span>
                  <div>
                    <h2 className="font-extrabold text-navy-950">{lender.displayName}</h2>
                    <p className="mt-1 text-xs text-slate-500">{lender.legalName} · {lender.regulatedEntityType || "Unspecified"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wide">
                  <Flag on={lender.active} label="Active" />
                  <Flag on={lender.verified} label="Verified" />
                  <Flag on={lender.productDetailsApproved} label="Approved" />
                  <Flag on={lender.legalAgreementActive} label="Agreement" />
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {lender.products.map((product) => {
                  const rules = parseProductRules(product.eligibilityRules);
                  return (
                    <div key={product.id} className="rounded-xl bg-surface p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-navy-950">{product.name} <span className="font-medium text-slate-500">· {product.category}</span></p>
                        <Flag on={product.active} label={product.active ? "Product on" : "Product off"} />
                      </div>
                      {rules ? (
                        <p className="mt-2 break-all text-xs leading-5 text-slate-600">
                          Apply URL: <a className="font-semibold text-brand-700 underline" href={rules.applyUrl} target="_blank" rel="noreferrer">{rules.applyUrl}</a>
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-amber-700">Missing eligibilityRules.applyUrl — excluded from matching.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))
        )}
      </div>
    </AdminShell>
  );
}

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${on ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-500"}`}>
      {on ? <BadgeCheck size={12} /> : null}
      {label}
    </span>
  );
}
