export function canAccessPaidReport(input: { orderStatus: string; reportId: string; tokenSubject?: string; expiresAt?: Date | null; now?: Date }) {
  const now = input.now ?? new Date();
  return input.orderStatus === "PAID" && input.tokenSubject === input.reportId && (!input.expiresAt || input.expiresAt > now);
}
