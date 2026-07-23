import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "Admin Login", robots: { index: false, follow: false } };
export default function AdminLoginPage() { return <section className="min-h-[75vh] bg-surface py-16"><div className="page-shell"><div className="mx-auto max-w-md"><AdminLoginForm /></div></div></section>; }
