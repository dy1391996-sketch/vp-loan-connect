export type ConsentSnapshot = { type: "SERVICE" | "MARKETING" | "LENDER_REFERRAL"; accepted: boolean; withdrawnAt?: Date | null; createdAt: Date };

export function hasActiveConsent(logs: ConsentSnapshot[], type: ConsentSnapshot["type"], optedOutAt?: Date | null) {
  if (type === "MARKETING" && optedOutAt) return false;
  const latest = logs.filter((log) => log.type === type).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return Boolean(latest?.accepted && !latest.withdrawnAt);
}
