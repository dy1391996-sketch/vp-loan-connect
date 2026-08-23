import { redirect } from "next/navigation";

/** Legacy entry; keep query string (UTM / amount / loanType) for assessment prefills. */
export default async function CheckPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) query.set(key, value);
    else if (Array.isArray(value) && value[0]) query.set(key, value[0]);
  }
  const suffix = query.toString();
  redirect(suffix ? `/apply/quick?${suffix}` : "/apply/quick");
}
