import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const required: Array<[string, () => Promise<number>]> = [
    ["User", () => prisma.user.count()],
    ["Studio", () => prisma.studio.count()],
    ["PricingRule", () => prisma.pricingRule.count()],
    ["BusinessSetting", () => prisma.businessSetting.count()],
  ];
  for (const [name, fn] of required) {
    const count = await fn();
    console.log(`${name}: ${count}`);
    if (count === 0) throw new Error(`${name} has no rows — run pnpm db:seed`);
  }
  console.log("Readiness OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
