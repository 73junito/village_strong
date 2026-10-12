import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "./components/site-chrome";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://villagestrongfoundation.org"),
  title: {
    default: "Village Strong Foundation | FAMILY",
    template: "%s | Village Strong Foundation",
  },
  description:
    "Village Strong Foundation is developing Kentucky family support, fatherhood engagement, and fatherhood research initiatives.",
  other: { "codex-preview": "development" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
