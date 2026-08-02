import { PageHeader } from "@/components/ui/primitives";
import { EmptyOrTable, Money, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { PricingRuleForm } from "@/components/command/pricing-rule-form";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function PricingPage() {
  await requirePermission("pricing:manage");
  const rules = await prisma.pricingRule.findMany({ orderBy: [{ active: "desc" }, { priority: "asc" }, { createdAt: "desc" }] });
  return (
    <div className="space-y-6">
      <PageHeader title="Pricing rules" description="Real pricing slabs, surcharges, discounts and coupon rules used by booking quotes." />
      <PricingRuleForm />
      <EmptyOrTable count={rules.length} title="No pricing rules" description="Add a weekday, weekend or hourly rule before quoting bookings.">
        <ScrollTable>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Day</Th>
              <Th>Hours</Th>
              <Th>Amount</Th>
              <Th>Priority</Th>
              <Th>State</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rules.map((rule) => (
              <tr key={rule.id}>
                <Td className="font-medium">{rule.name}</Td>
                <Td>{rule.type.replaceAll("_", " ")}</Td>
                <Td>{rule.dayType}</Td>
                <Td>{rule.minHours ?? "-"} - {rule.maxHours ?? "-"}</Td>
                <Td>{rule.isPercent ? `${rule.percentValue ?? 0}%` : <Money value={rule.amountInr} />}</Td>
                <Td>{rule.priority}</Td>
                <Td><StatusBadge value={rule.active ? (rule.approved ? "ACTIVE" : "PENDING_APPROVAL") : "INACTIVE"} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
