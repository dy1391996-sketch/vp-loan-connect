import { PrismaClient, ProductType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const assessmentQuestions = [
  { key: "fullName", step: 1, label: "Full name", required: true },
  { key: "mobile", step: 1, label: "WhatsApp mobile number", required: true },
  { key: "state", step: 1, label: "State", required: true },
  { key: "city", step: 1, label: "City", required: true },
  { key: "loanAmount", step: 1, label: "Required loan amount", required: true },
  { key: "loanPurpose", step: 1, label: "Loan purpose", required: true },
  { key: "loanType", step: 1, label: "Loan type", required: true },
  { key: "employmentType", step: 2, label: "Employment type", required: true },
  { key: "monthlyIncomeRange", step: 2, label: "Monthly net income range", required: true },
  { key: "durationMonths", step: 2, label: "Employment or business duration", required: true },
  { key: "existingEmi", step: 3, label: "Existing monthly EMIs", required: true },
  { key: "creditRange", step: 3, label: "Approximate credit-score range", required: true },
  { key: "documents", step: 4, label: "Document readiness", required: true },
];

const scoreBands = [
  { min: 80, max: 100, label: "Strong readiness" },
  { min: 65, max: 79, label: "Moderate readiness" },
  { min: 45, max: 64, label: "Improvement required" },
  { min: 0, max: 44, label: "High rejection risk" },
];

const messageTemplates = {
  ASSESSMENT_STARTED: "Namaste [Name], आपका VP Loan Connect profile check शुरू हो गया है। इसे पूरा करने के लिए यहाँ जाएँ: [link]. यह lender approval नहीं है।",
  INCOMPLETE_ASSESSMENT: "आपकी profile assessment अभी अधूरी है। Income, EMI और document readiness check पूरा करें: [link].",
  FREE_RESULT_READY: "आपका preliminary profile result तैयार है। Result देखें: [link]. Final loan decision lender verification के बाद होता है।",
  PAYMENT_SUCCESS: "आपका payment सफल रहा। Reference: [reference]. आपकी personalized report तैयार की जा रही है।",
  REPORT_READY: "आपकी VP Loan Connect report तैयार है। Download करें: [secure link].",
  OPT_OUT_CONFIRMATION: "आपकी marketing communication preference बंद कर दी गई है। आपकी मौजूदा service requests से जुड़ी जरूरी updates फिर भी भेजी जा सकती हैं।",
};

async function main() {
  await prisma.product.upsert({
    where: { slug: "credit-health-action-plan" },
    update: {},
    create: {
      slug: "credit-health-action-plan",
      name: "VP Credit Health Action Plan",
      type: ProductType.CREDIT_HEALTH_ACTION_PLAN,
      regularPrice: 199,
      salePrice: 99,
      gstRate: 18,
      deliverables: [
        "Personalized credit-health summary",
        "Credit-risk factors and EMI burden analysis",
        "Credit utilization and dispute-process guidance",
        "30-day action plan and 90-day roadmap",
        "Branded downloadable PDF",
        "WhatsApp support instructions",
      ],
    },
  });

  await prisma.product.upsert({
    where: { slug: "complete-loan-readiness-report" },
    update: {},
    create: {
      slug: "complete-loan-readiness-report",
      name: "Complete Loan Readiness Report",
      type: ProductType.LOAN_READINESS_REPORT,
      regularPrice: 599,
      salePrice: 299,
      gstRate: 18,
      deliverables: [
        "Financial-profile and monthly obligation analysis",
        "Internal loan-readiness score",
        "Strengths, risks and missing-document checklist",
        "Indicative comfortable EMI range",
        "30-day application-preparation plan",
        "Branded PDF and consultation request",
      ],
    },
  });

  const settings = [
    { key: "assessment_questions", value: assessmentQuestions, description: "Versioned assessment question catalogue" },
    { key: "score_bands", value: scoreBands, description: "Educational internal readiness score labels", public: true },
    { key: "referral_reward_credit_health", value: { amount: 20, currency: "INR" }, description: "Reward for a validated ₹99 product order" },
    { key: "referral_validation_days", value: 14, description: "Days a reward remains pending before approval" },
    { key: "referral_minimum_payout", value: { amount: 250, currency: "INR" }, description: "Minimum approved balance for payout", public: true },
    { key: "referral_milestone_bonuses", value: { "5": 0, "10": 0, "25": 0 }, description: "Owner-configurable milestone bonuses; zero until approved" },
    { key: "message_templates", value: messageTemplates, description: "WhatsApp Business Platform-ready service templates" },
    { key: "legal_content_status", value: { status: "OWNER_REVIEW_REQUIRED", version: "2026-07-v1" }, description: "Policy content must be reviewed for business-specific facts" },
    { key: "report_link_expiry_hours", value: 72, description: "Default signed report-link validity" },
  ];

  for (const setting of settings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description, public: setting.public ?? false },
      create: { ...setting, public: setting.public ?? false },
    });
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (email && password && password.length >= 12) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.adminUser.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, fullName: "Platform Administrator", role: "SUPER_ADMIN" },
    });
    console.info(`Seeded administrator: ${email}`);
  } else {
    console.info("Skipped administrator seed. Set a unique ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD (12+ characters).");
  }

  console.info("VP Loan Connect seed completed without demo customers, lenders, approvals, or testimonials.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
