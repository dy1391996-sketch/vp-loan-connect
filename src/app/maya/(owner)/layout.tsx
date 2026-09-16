import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function MayaOwnerLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get("maya_owner")?.value;
  if (!token) redirect("/maya/login");
  return children;
}
