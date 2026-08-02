export type CreditBand =
  | "BELOW_550"
  | "550_599"
  | "600_649"
  | "650_699"
  | "700_749"
  | "750_PLUS"
  | "UNKNOWN";

export type EmploymentType =
  | "SALARIED"
  | "SELF_EMPLOYED"
  | "BUSINESS_OWNER"
  | "FREELANCER"
  | "OTHER";

/** Stored in LenderProduct.eligibilityRules JSON */
export type MatchEligibilityRules = {
  applyUrl: string;
  description: string;
  disclosure: string;
  employmentTypes?: EmploymentType[];
  /** Minimum credit band ordinal (inclusive). UNKNOWN treated as mid-band. */
  minCreditBand?: CreditBand;
  maxAmount?: number;
  minAmount?: number;
  categories?: string[];
  preferStrongCredit?: boolean;
  shortTermFriendly?: boolean;
};

export type CatalogLenderSeed = {
  legalName: string;
  displayName: string;
  regulatedEntityType: string;
  productName: string;
  category: string;
  rules: MatchEligibilityRules;
};

/**
 * Public official application entry points used for educational matching.
 * Not exclusive partnership claims — each lender's policy / KFS governs.
 */
export const MATCH_CATALOG: CatalogLenderSeed[] = [
  {
    legalName: "KreditBee Digital Lending",
    displayName: "KreditBee",
    regulatedEntityType: "Digital lending / LSP journey",
    productName: "Personal Loan",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://www.kreditbee.in/personal-loan",
      description: "Digital personal-loan journey suited to smaller ticket and salaried profiles.",
      disclosure: "Loan amount, APR and tenure depend on lender assessment.",
      employmentTypes: ["SALARIED", "OTHER"],
      maxAmount: 300000,
      shortTermFriendly: true,
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "Fibe",
    displayName: "Fibe",
    regulatedEntityType: "Digital lending",
    productName: "Personal Loan",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://www.fibe.in/personal-loan/",
      description: "Digital personal loans oriented to salaried applicants.",
      disclosure: "Official site states rates from 18% p.a.; final KFS governs.",
      employmentTypes: ["SALARIED"],
      maxAmount: 1000000,
      shortTermFriendly: true,
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "Moneyview",
    displayName: "Moneyview",
    regulatedEntityType: "Digital lending",
    productName: "Personal Loan",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://moneyview.in/loans/personal-loan",
      description: "Online personal-loan application with profile-based eligibility checks.",
      disclosure: "Check the lender, APR, fees and KFS before accepting.",
      employmentTypes: ["SALARIED", "SELF_EMPLOYED", "OTHER"],
      maxAmount: 1000000,
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "Hero FinCorp Limited",
    displayName: "Hero FinCorp",
    regulatedEntityType: "NBFC",
    productName: "Personal Loan",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://loans.apps.herofincorp.com/en/personal-loan",
      description: "Official NBFC personal-loan application for eligible applicants.",
      disclosure: "Public official application entry. Not an exclusive VP partnership claim; lender policy and KFS govern.",
      employmentTypes: ["SALARIED", "SELF_EMPLOYED", "BUSINESS_OWNER", "OTHER"],
      minCreditBand: "600_649",
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "Buddy Loan",
    displayName: "Buddy Loan",
    regulatedEntityType: "LSP / marketplace",
    productName: "Multi-lender Personal Loan",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://www.buddyloan.com/",
      description: "Digital loan marketplace that may connect applicants with partner lenders.",
      disclosure: "Buddy Loan is a platform/LSP; the actual lender issues the loan.",
      shortTermFriendly: true,
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "Paisabazaar",
    displayName: "Paisabazaar",
    regulatedEntityType: "Marketplace / LSP",
    productName: "Compare Personal Loans",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://www.paisabazaar.com/personal-loan/",
      description: "Compare personal-loan offers from participating banks and NBFCs.",
      disclosure: "Offers and rates depend on the selected regulated lender.",
      preferStrongCredit: true,
      minCreditBand: "650_699",
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "Poonawalla Fincorp Limited",
    displayName: "Poonawalla Fincorp",
    regulatedEntityType: "NBFC",
    productName: "Personal Loan",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://poonawallafincorp.com/personal-loan",
      description: "Direct NBFC personal-loan journey suited to stronger verified profiles.",
      disclosure: "Official rates and approval remain subject to policy and verification.",
      employmentTypes: ["SALARIED", "SELF_EMPLOYED"],
      preferStrongCredit: true,
      minCreditBand: "700_749",
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "ZipLoan",
    displayName: "ZipLoan",
    regulatedEntityType: "Business lending",
    productName: "Business Loan",
    category: "Business Loan",
    rules: {
      applyUrl: "https://ziploan.in/",
      description: "Digital business-loan option for eligible small-business owners.",
      disclosure: "Business vintage, turnover and lender verification apply.",
      employmentTypes: ["SELF_EMPLOYED", "BUSINESS_OWNER", "FREELANCER"],
      categories: ["Business Loan", "MSME Loan"],
    },
  },
  {
    legalName: "TransUnion CIBIL",
    displayName: "Official CIBIL Report",
    regulatedEntityType: "Credit bureau",
    productName: "Free Annual Credit Report",
    category: "Credit Health Support",
    rules: {
      applyUrl: "https://www.cibil.com/freecibilscore",
      description: "Check your official annual CIBIL score and report before making multiple applications.",
      disclosure: "VP Loan Connect cannot create or directly alter a bureau score.",
      categories: ["Credit Health Support", "Personal Loan", "Business Loan"],
    },
  },
  {
    legalName: "CASHe",
    displayName: "CASHe",
    regulatedEntityType: "Digital lending",
    productName: "Personal Loan",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://www.cashe.co.in/",
      description: "App-based personal credit for salaried professionals.",
      disclosure: "Final sanction, APR and tenure are decided only by the lender.",
      employmentTypes: ["SALARIED", "OTHER"],
      maxAmount: 400000,
      shortTermFriendly: true,
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "Bajaj Finance Limited",
    displayName: "Bajaj Finserv",
    regulatedEntityType: "NBFC",
    productName: "Personal Loan",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://www.bajajfinserv.in/personal-loan",
      description: "Official Bajaj Finserv personal-loan application journey.",
      disclosure: "Check Key Fact Statement and charges on the lender site before accepting.",
      employmentTypes: ["SALARIED", "SELF_EMPLOYED", "BUSINESS_OWNER"],
      minCreditBand: "650_699",
      preferStrongCredit: true,
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "Tata Capital Limited",
    displayName: "Tata Capital",
    regulatedEntityType: "NBFC",
    productName: "Personal Loan",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://www.tatacapital.com/personal-loan.html",
      description: "NBFC personal-loan option for eligible salaried and self-employed applicants.",
      disclosure: "Eligibility and pricing remain subject to lender verification.",
      employmentTypes: ["SALARIED", "SELF_EMPLOYED"],
      minCreditBand: "650_699",
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "InCred Financial Services Limited",
    displayName: "InCred",
    regulatedEntityType: "NBFC",
    productName: "Personal Loan",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://www.incred.com/personal-loan/",
      description: "Digital personal-loan journey from InCred.",
      disclosure: "Official rates and approval depend on profile assessment by InCred.",
      employmentTypes: ["SALARIED", "SELF_EMPLOYED", "OTHER"],
      maxAmount: 1000000,
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "Navi Technologies Limited",
    displayName: "Navi",
    regulatedEntityType: "Digital lending",
    productName: "Personal Loan",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://navi.com/personal-loan",
      description: "App-led personal loans for eligible Indian residents.",
      disclosure: "Lender policy and KFS govern amount, APR and tenure.",
      employmentTypes: ["SALARIED", "SELF_EMPLOYED", "OTHER"],
      shortTermFriendly: true,
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "Prefr",
    displayName: "Prefr",
    regulatedEntityType: "Digital lending / LSP",
    productName: "Personal Loan",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://www.prefr.com/",
      description: "Digital personal-loan marketplace journey.",
      disclosure: "The regulated partner lender decides final eligibility.",
      shortTermFriendly: true,
      maxAmount: 500000,
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "BankBazaar",
    displayName: "BankBazaar",
    regulatedEntityType: "Marketplace / LSP",
    productName: "Compare Personal Loans",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://www.bankbazaar.com/personal-loan.html",
      description: "Compare personal-loan options from participating banks and NBFCs.",
      disclosure: "Offers come from regulated lenders listed on BankBazaar.",
      preferStrongCredit: true,
      minCreditBand: "650_699",
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "IndiaLends",
    displayName: "IndiaLends",
    regulatedEntityType: "Marketplace / LSP",
    productName: "Personal Loan Marketplace",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://indialends.com/",
      description: "Marketplace that may match applicants with partner lending options.",
      disclosure: "IndiaLends is a platform; the loan is issued by a regulated lender.",
      categories: ["Personal Loan"],
    },
  },
  {
    legalName: "Lendingkart Finance Limited",
    displayName: "Lendingkart",
    regulatedEntityType: "NBFC / business lending",
    productName: "Business Loan",
    category: "Business Loan",
    rules: {
      applyUrl: "https://www.lendingkart.com/",
      description: "Working-capital oriented business loans for eligible MSMEs.",
      disclosure: "Business documents and lender checks apply.",
      employmentTypes: ["SELF_EMPLOYED", "BUSINESS_OWNER"],
      categories: ["Business Loan", "MSME Loan"],
    },
  },
  {
    legalName: "mPokket",
    displayName: "mPokket",
    regulatedEntityType: "Digital lending",
    productName: "Short-term Credit",
    category: "Personal Loan",
    rules: {
      applyUrl: "https://www.mpokket.com/",
      description: "Short-term digital credit often used by younger salaried / student profiles.",
      disclosure: "Review tenure, fees and repayment terms carefully on the official app/site.",
      maxAmount: 60000,
      shortTermFriendly: true,
      categories: ["Personal Loan"],
    },
  },
];

export const CREDIT_BAND_RANK: Record<CreditBand, number> = {
  BELOW_550: 0,
  "550_599": 1,
  "600_649": 2,
  "650_699": 3,
  "700_749": 4,
  "750_PLUS": 5,
  UNKNOWN: 2,
};
