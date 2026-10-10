import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Village Strong | FAMILY Foundation",
  description:
    "Village Strong Foundation is developing family support, fatherhood engagement and education, and fatherhood research initiatives.",
  other: { "codex-preview": "development" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
