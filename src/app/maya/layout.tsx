import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maya",
  robots: { index: false, follow: false },
};

export default function MayaLayout({ children }: { children: React.ReactNode }) {
  return <div className="maya-shell h-screen overflow-hidden bg-[#120b10] text-[#f6efe8]">{children}</div>;
}
