import Link from "next/link";

const initiatives = [
  {
    label: "Village Strong",
    title: "Family & Community Support",
    href: "/village-strong",
    description:
      "Proposed caregiver resources, positive youth development, mentorship, and community partnerships.",
    className: "village-card",
  },
  {
    label: "FAMILY",
    title: "Fatherhood Engagement & Education",
    href: "/family",
    description:
      "A proposed fatherhood initiative focused on paternal identity, parenting knowledge, well-being, and family involvement.",
    className: "family-card",
  },
  {
    label: "Research",
    title: "Fatherhood Research & Evaluation",
    href: "/research",
    description:
      "A developing research agenda for paternal adjustment, father well-being, measurement concepts, and future evaluation.",
    className: "research-card",
  },
];

export default function GatewayPage() {
  return (
    <main className="gateway">
      <header className="gateway-header">
        <Link className="gateway-wordmark" href="/">Village Strong Foundation</Link>
        <nav aria-label="Primary navigation">
          <a href="#about">About</a>
          <a href="#initiatives">Initiatives</a>
          <Link href="/research">Research</Link>
          <a href="#connect">Contact</a>
        </nav>
      </header>

      <section className="gateway-intro">
        <p className="overline">Village Strong Foundation</p>
        <h1>Building Stronger Families. Strengthening Communities.</h1>
        <p>
          Village Strong Foundation is developing community-centered initiatives
          focused on supporting children, caregivers, fathers, and families. Our
          proposed programs and research activities are currently in the planning stage.
        </p>
        <p className="development-badge">In Development - Not Currently Enrolling</p>
      </section>

      <section className="development-notice" aria-label="Program development notice">
        <strong>Planning and development phase.</strong>
        <p>
          No pilot program has launched, no formal educational courses are currently
          being delivered, and no educational or professional credentials are currently
          being issued. Future activities remain subject to program development,
          applicable permissions, and regulatory review.
        </p>
      </section>

      <section id="initiatives" className="gateway-grid three-up" aria-label="Initiatives in development">
        {initiatives.map((initiative) => (
          <Link className={`gateway-card ${initiative.className}`} href={initiative.href} key={initiative.href}>
            <div>
              <span className="card-status">In Development</span>
              <span className="card-label">{initiative.label}</span>
              <h2>{initiative.title}</h2>
              <p>{initiative.description}</p>
              <span className="text-link">Learn more <b aria-hidden="true">→</b></span>
            </div>
          </Link>
        ))}
      </section>

      <section id="about" className="foundation-section">
        <div>
          <p className="overline">Who we are</p>
          <h2>One foundation. Three connected areas of development.</h2>
        </div>
        <div>
          <p>
            Village Strong Foundation is the organizational umbrella for proposed
            family and community support, fatherhood engagement and education, and
            fatherhood research and evaluation.
          </p>
          <p>
            The website describes plans under development. It is not an offer of
            enrollment or a claim of accreditation, state approval, professional
            qualification, or government endorsement.
          </p>
        </div>
      </section>

      <section id="connect" className="connect-section">
        <p className="overline">Connect with us</p>
        <h2>Explore partnership opportunities.</h2>
        <p>
          We welcome general inquiries from community organizations, educators,
          researchers, and prospective partners. Contact does not enroll you in a
          program, guarantee services, or reserve a future place.
        </p>
        <a className="foundation-button" href="mailto:darodriguez1274@gmail.com">Contact our team</a>
      </section>

      <footer className="foundation-footer">
        <p>Programs in development. No formal enrollment or credentials currently offered.</p>
        <a href="mailto:darodriguez1274@gmail.com">darodriguez1274@gmail.com</a>
      </footer>
    </main>
  );
}
