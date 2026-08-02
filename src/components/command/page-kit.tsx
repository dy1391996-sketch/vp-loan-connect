import Link from "next/link";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { formatInr } from "@/lib/utils";

type BadgeTone = "neutral" | "success" | "warn" | "danger" | "info";

export function ScrollTable({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-sm">{children}</table>
      </div>
    </Card>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-700/70">{children}</th>;
}

export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-4 py-3 align-top text-ink-800 ${className}`}>{children}</td>;
}

export function LinkCell({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-copper-600 hover:text-copper-500">
      {children}
    </Link>
  );
}

export function StatusBadge({ value }: { value?: string | null }) {
  const normalized = value ?? "UNKNOWN";
  const tone: BadgeTone =
    normalized.includes("CONFIRMED") ||
    normalized.includes("PAID") ||
    normalized.includes("ACTIVE") ||
    normalized.includes("READY") ||
    normalized.includes("APPROVED") ||
    normalized.includes("COMPLETED")
      ? "success"
      : normalized.includes("PENDING") ||
          normalized.includes("HOLD") ||
          normalized.includes("DRAFT") ||
          normalized.includes("SCHEDULED") ||
          normalized.includes("IN_PROGRESS")
        ? "warn"
        : normalized.includes("FAILED") ||
            normalized.includes("CANCELLED") ||
            normalized.includes("LOST") ||
            normalized.includes("SPAM") ||
            normalized.includes("BLOCKED") ||
            normalized.includes("DIRTY") ||
            normalized.includes("REJECTED")
          ? "danger"
          : "neutral";

  return <Badge tone={tone}>{normalized.replaceAll("_", " ")}</Badge>;
}

export function DateTime({ value }: { value?: Date | string | null }) {
  if (!value) return <span className="text-ink-700/50">-</span>;
  return <span>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))}</span>;
}

export function DateOnly({ value }: { value?: Date | string | null }) {
  if (!value) return <span className="text-ink-700/50">-</span>;
  return <span>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value))}</span>;
}

export function Money({ value }: { value?: number | null }) {
  return <span>{formatInr(value ?? 0)}</span>;
}

export function KeyValueGrid({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/60">{item.label}</p>
          <div className="mt-1 text-sm text-ink-950">{item.value}</div>
        </div>
      ))}
    </Card>
  );
}

export function EmptyOrTable({
  count,
  title,
  description,
  children,
}: {
  count: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  if (count === 0) return <EmptyState title={title} description={description} />;
  return <>{children}</>;
}

export function JsonBlock({ value }: { value: unknown }) {
  return <pre className="overflow-auto rounded-xl bg-ink-950 p-4 text-xs text-sand-50">{JSON.stringify(value, null, 2)}</pre>;
}
