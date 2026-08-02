"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import type { StaffRole } from "@prisma/client";
import { BRAND, NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";

export function CommandShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: StaffRole };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));
  const sections = [...new Set(items.map((i) => i.section ?? "Other"))];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-col gap-4 p-4">
      <div className="px-2">
        <p className="font-display text-xl text-sand-50">{BRAND.name}</p>
        <p className="text-xs text-sand-200/70">{BRAND.tagline} · Command Center</p>
      </div>
      {sections.map((section) => (
        <div key={section}>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sand-200/50">{section}</p>
          <ul className="space-y-0.5">
            {items
              .filter((i) => (i.section ?? "Other") === section)
              .map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block rounded-lg px-2.5 py-2 text-sm transition",
                        active ? "bg-copper-600/90 text-white" : "text-sand-100/80 hover:bg-ink-800 hover:text-white",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      <div className="mt-auto border-t border-ink-700 pt-4">
        <p className="px-2 text-sm text-sand-50">{user.name}</p>
        <p className="px-2 text-xs text-sand-200/60">{user.role.replaceAll("_", " ")}</p>
        <Button variant="ghost" size="sm" className="mt-2 w-full justify-start text-sand-100" onClick={logout}>
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden bg-ink-950 lg:flex lg:min-h-dvh lg:flex-col">{nav}</aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-ink-950/60" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="relative z-10 flex h-full w-[80%] max-w-xs flex-col bg-ink-950">{nav}</aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/70 bg-sand-50/90 px-4 py-3 backdrop-blur lg:hidden">
          <div>
            <p className="font-display text-lg text-ink-950">{BRAND.name}</p>
            <p className="text-[11px] text-ink-700/70">AI Command Center</p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-line bg-white p-2"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </header>
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
