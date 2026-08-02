import { isValidPanFormat, normalizePan, panFormatStatus, panHolderTypeLabel, type PanFormatStatus, type PanVerificationStatus } from "@/lib/domain/identity";

/**
 * Authorised PAN/KYC verification abstraction.
 * Format validation ≠ identity verification. Never invent a successful verify response.
 */
export type PanCheckResult = {
  formatStatus: PanFormatStatus;
  verificationStatus: PanVerificationStatus;
  holderTypeLabel: string | null;
  normalizedPan: string;
  message: string;
  checkedAt: string;
  provider: string;
};

export interface PanVerificationProvider {
  readonly id: string;
  checkFormat(pan: string): PanCheckResult;
  /** Identity verification — only implement when an authorised provider is connected. */
  verifyIdentity?(input: { pan: string; fullName: string }): Promise<PanCheckResult>;
}

export class FormatOnlyPanProvider implements PanVerificationProvider {
  readonly id = "format_only";

  checkFormat(pan: string): PanCheckResult {
    const normalizedPan = normalizePan(pan);
    const formatStatus = panFormatStatus(normalizedPan);
    const checkedAt = new Date().toISOString();
    if (formatStatus === "not_entered") {
      return {
        formatStatus,
        verificationStatus: "not_verified",
        holderTypeLabel: null,
        normalizedPan,
        message: "Enter PAN to continue.",
        checkedAt,
        provider: this.id,
      };
    }
    if (formatStatus === "invalid_format") {
      return {
        formatStatus,
        verificationStatus: "not_verified",
        holderTypeLabel: null,
        normalizedPan,
        message: "Enter a valid 10-character PAN (e.g. ABCDE1234F).",
        checkedAt,
        provider: this.id,
      };
    }
    return {
      formatStatus: "format_valid",
      verificationStatus: "not_verified",
      holderTypeLabel: panHolderTypeLabel(normalizedPan),
      normalizedPan,
      message: "PAN format validated — identity verification pending.",
      checkedAt,
      provider: this.id,
    };
  }
}

let activeProvider: PanVerificationProvider = new FormatOnlyPanProvider();

export function getPanProvider(): PanVerificationProvider {
  return activeProvider;
}

/** For tests / future authorised provider wiring only. */
export function setPanProviderForTests(provider: PanVerificationProvider) {
  activeProvider = provider;
}

export function assertFormatOnlyNeverClaimsVerified(result: PanCheckResult) {
  if (result.provider === "format_only" && result.verificationStatus === "verified_authorised_provider") {
    throw new Error("Format-only provider must never return verified_authorised_provider.");
  }
  if (!isValidPanFormat(result.normalizedPan) && result.formatStatus === "format_valid") {
    throw new Error("Invalid PAN cannot be marked format_valid.");
  }
}
