import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  ".env.example",
  ".github/workflows/ci.yml",
  "ADMIN_MANUAL.md",
  "API_DOCUMENTATION.md",
  "CHANGELOG.md",
  "DEPLOY_CHECKLIST.md",
  "QA_REPORT.md",
  "RELEASE.md",
  "SECURITY_CHECKLIST.md",
  "USER_GUIDE.md",
  "prisma/migrations/20260723000000_initial/migration.sql",
  "prisma/schema.prisma",
  "src/app/page.tsx",
  "src/app/assessment/page.tsx",
  "src/app/result/[id]/page.tsx",
  "src/app/checkout/page.tsx",
  "src/app/report/[id]/page.tsx",
  "src/app/admin/page.tsx",
];

const requiredEnvironmentKeys = [
  "DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXTAUTH_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "WHATSAPP_PROVIDER",
  "WHATSAPP_API_URL",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "OTP_PROVIDER",
  "OTP_API_KEY",
  "ADMIN_EMAIL",
  "ADMIN_INITIAL_PASSWORD",
  "BUSINESS_NAME",
  "BUSINESS_GSTIN",
  "BUSINESS_ADDRESS",
  "SUPPORT_EMAIL",
  "SUPPORT_WHATSAPP",
  "REPORT_SIGNING_SECRET",
  "ANALYTICS_ID",
];

const failures: string[] = [];
for (const file of requiredFiles) {
  if (!existsSync(path.join(root, file))) failures.push(`Missing required file: ${file}`);
}

const envExample = readFileSync(path.join(root, ".env.example"), "utf8");
for (const key of requiredEnvironmentKeys) {
  if (!new RegExp(`^${key}=`, "m").test(envExample)) failures.push(`Missing environment key: ${key}`);
}

const unfinishedPattern = /\b(TODO|FIXME|TBD|LOREM IPSUM|COMING SOON|NOT IMPLEMENTED)\b|owner configuration pending|whatsapp number pending/i;
for (const file of collectFiles(path.join(root, "src"))) {
  if (unfinishedPattern.test(readFileSync(file, "utf8"))) failures.push(`Unfinished marker found: ${path.relative(root, file)}`);
}

const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
for (const script of ["build", "lint", "type-check", "test", "verify:migration", "verify:readiness"]) {
  if (!packageJson.scripts?.[script]) failures.push(`Missing package script: ${script}`);
}

if (failures.length) {
  for (const failure of failures) process.stderr.write(`${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Production readiness verification passed: ${requiredFiles.length} files, ${requiredEnvironmentKeys.length} environment keys, and source markers checked.\n`);
}

function collectFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const candidate = path.join(directory, entry);
    if (statSync(candidate).isDirectory()) return collectFiles(candidate);
    return /\.(ts|tsx|css)$/.test(candidate) ? [candidate] : [];
  });
}
