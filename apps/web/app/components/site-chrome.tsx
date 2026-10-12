import Link from "next/link";

const navigation = [
  ["Home", "/"],
  ["About VSF", "/about"],
  ["FAMILY", "/family"],
  ["How It Works", "/family/how-it-works"],
  ["Resources", "/resources"],
  ["Partnerships", "/partners"],
  ["Research", "/research"],
  ["Contact", "/contact"],
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="site-wordmark" href="/">
        <span>Village Strong Foundation</span>
        <small>Village Strong and FAMILY</small>
      </Link>
      <nav aria-label="Primary navigation">
        {navigation.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong>Village Strong Foundation</strong>
        <p>Programs and research are in development. Enrollment is not open.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/privacy">Privacy</Link>
        <Link href="/accessibility">Accessibility</Link>
        <Link href="/contact">Contact</Link>
      </nav>
      <p>© 2026 Village Strong Foundation</p>
    </footer>
  );
}
