import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MATCH_CATALOG } from "@/lib/matching/catalog";
import { candidatesFromCatalog, rankLoanMatches, type MatchProfile } from "@/lib/matching/profile-match";

const baseProfile: MatchProfile = {
  loanAmount: 75000,
  loanType: "PERSONAL",
  employmentType: "SALARIED",
  creditRange: "700_749",
  existingEmi: 5000,
  monthlyIncome: 50000,
  readinessScore: 78,
  emiBurden: "Low",
  documentationStatus: "Strong",
  suitableCategories: ["Personal Loan"],
};

describe("rankLoanMatches", () => {
  it("prioritises stronger-credit options for high credit bands", () => {
    const strong = rankLoanMatches(
      { ...baseProfile, creditRange: "750_PLUS", readinessScore: 88 },
      candidatesFromCatalog(MATCH_CATALOG),
    );
    assert.ok(strong.length > 0);
    assert.equal(strong[0].fitLabel, "Best profile fit");
    const names = strong.map((item) => item.name);
    assert.ok(names.includes("Paisabazaar") || names.includes("Poonawalla Fincorp") || names.includes("Hero FinCorp"));
  });

  it("surfaces business lenders for business owners", () => {
    const matches = rankLoanMatches(
      {
        ...baseProfile,
        loanType: "BUSINESS",
        employmentType: "BUSINESS_OWNER",
        creditRange: "650_699",
        suitableCategories: ["Business Loan", "MSME Loan"],
      },
      candidatesFromCatalog(MATCH_CATALOG),
    );
    assert.ok(matches.some((item) => item.name === "ZipLoan"));
  });

  it("puts CIBIL report high when credit is weak/unknown", () => {
    const matches = rankLoanMatches(
      { ...baseProfile, creditRange: "UNKNOWN", readinessScore: 40, documentationStatus: "Partial" },
      candidatesFromCatalog(MATCH_CATALOG),
      12,
    );
    const cibilIndex = matches.findIndex((item) => item.name === "Official CIBIL Report");
    assert.ok(cibilIndex >= 0 && cibilIndex <= 3);
  });

  it("filters min-credit products for weak bands", () => {
    const matches = rankLoanMatches(
      { ...baseProfile, creditRange: "BELOW_550", readinessScore: 30 },
      candidatesFromCatalog(MATCH_CATALOG),
    );
    assert.ok(!matches.some((item) => item.name === "Poonawalla Fincorp"));
  });
});
