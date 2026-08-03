"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

/** Hides marketing chrome inside conversion funnels (Quick Apply). */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isFunnel = pathname.startsWith("/apply");

  if (isFunnel) {
    return <main id="main-content">{children}</main>;
  }

  return (
    <>
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
    </>
  );
}
