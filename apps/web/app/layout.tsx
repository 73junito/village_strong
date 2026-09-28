import type { Metadata } from "next";
import "./globals.css";
import "./catalog.css";

export const metadata: Metadata = {
  title: "Village Strong | FAMILY Foundation",
  description: "Noncredit education in human and child development, fatherhood science, and parent education.",
  other: { "codex-preview": "development" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
