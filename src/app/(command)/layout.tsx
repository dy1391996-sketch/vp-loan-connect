import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { CommandShell } from "@/components/command/shell";

export default async function CommandLayout({ children }: { children: React.ReactNode }) {
  const auth = await getSession();
  if (!auth) redirect("/login");
  return (
    <CommandShell user={{ name: auth.user.name, email: auth.user.email, role: auth.user.role }}>
      {children}
    </CommandShell>
  );
}
