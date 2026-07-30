import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Village Strong | FAMILY Foundation",
  description: "Two distinct community programs supporting children, fathers, and families.",
  other: { "codex-preview": "development" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
