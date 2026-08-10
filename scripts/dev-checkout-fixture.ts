/**
 * Local-only helper: creates a completed assessment and prints a signed /checkout URL
 * so the payment journey can be exercised in a browser without email OTP.
 * Refuses to run against a production database.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { signAccessToken } from "../src/lib/security/tokens";

if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
  throw new Error("dev-checkout-fixture must never run against production.");
}

const databaseHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname.toLowerCase();
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "::1"].includes(databaseHost)) {
  throw new Error(`dev-checkout-fixture only runs against a local database (got host "${databaseHost || "unknown"}").`);
}

const prisma = new PrismaClient();

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const lead = await prisma.lead.create({
    data: {
      fullName: "Local Checkout Tester",
      mobile: `+9198${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
      referralCode: `DEV${suffix}`.toUpperCase(),
      stage: "FREE_RESULT_VIEWED",
    },
  });

  const assessment = await prisma.assessment.create({
    data: {
      leadId: lead.id,
      status: "COMPLETED",
      loanAmount: 300000,
      loanType: "PERSONAL",
      loanPurpose: "Personal expenses",
      employmentType: "SALARIED",
      monthlyIncomeRange: "50000-75000",
      monthlyIncome: 60000,
      existingEmi: 8000,
      creditRange: "GOOD",
      completionPercent: 100,
      completedAt: new Date(),
      answers: { create: [{ questionKey: "email", value: "local.tester@example.com" }] },
      score: {
        create: {
          readinessScore: 74,
          readinessLabel: "Good",
          emiBurden: "Moderate",
          documentationStatus: "Partial",
          creditHealthStatus: "Healthy",
          comfortableEmiMin: 6000,
          comfortableEmiMax: 14000,
          suitableCategories: ["PERSONAL"],
          strengths: ["Stable salaried income"],
          improvements: ["Reduce existing EMI load"],
          factorBreakdown: {},
          engineVersion: "dev-fixture",
        },
      },
    },
  });

  const token = await signAccessToken("result_access", assessment.id, { leadId: lead.id }, "2h");
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  console.log(
    `${base}/checkout?assessment=${assessment.id}&product=credit-health-action-plan&token=${encodeURIComponent(token)}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
