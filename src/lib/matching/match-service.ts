import { prisma } from "@/lib/db";
import { MATCH_CATALOG } from "@/lib/matching/catalog";
import {
  candidatesFromCatalog,
  parseProductRules,
  rankLoanMatches,
  type MatchProfile,
  type MatchedOption,
} from "@/lib/matching/profile-match";

export type { MatchedOption, MatchProfile };

export async function getProfileMatchedOptions(profile: MatchProfile, limit = 6): Promise<MatchedOption[]> {
  const products = await prisma.lenderProduct.findMany({
    where: {
      active: true,
      lender: {
        active: true,
        verified: true,
        productDetailsApproved: true,
      },
    },
    include: { lender: true },
  });

  const fromDb = products
    .map((product) => {
      const rules = parseProductRules(product.eligibilityRules);
      if (!rules) return null;
      return {
        id: product.id,
        lenderName: product.lender.displayName,
        productName: product.name,
        category: product.category,
        rules,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const candidates = fromDb.length > 0 ? fromDb : candidatesFromCatalog(MATCH_CATALOG);
  return rankLoanMatches(profile, candidates, limit);
}
