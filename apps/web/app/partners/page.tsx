import Link from "next/link";

const partnerTypes = [
  "Fatherhood and family-support organizations",
  "Community prevention networks",
  "Libraries and accessible meeting sites",
  "Health and behavioral-health referral providers",
  "Veteran, workforce, reentry, and employer organizations",
  "Independent research and evaluation partners",
] as const;

export default function PartnersPage() {
  return (
    <main id="main-content" className="content-page">
      <section className="content-hero">
        <p className="overline">Partnerships</p>
        <h1>Building a responsible Kentucky partnership network.</h1>
        <p>
          Village Strong Foundation welcomes planning conversations about technical
          assistance, accessible meeting space, future referrals, safeguarding,
          capacity building, and independent evaluation.
        </p>
        <p className="development-badge">Prospective Partnerships - No Referrals Accepted</p>
      </section>

      <section className="content-section two-column">
        <div>
          <p className="overline">Partners sought</p>
          <h2>Organizations aligned with safe, voluntary father engagement.</h2>
        </div>
        <ul className="plain-list">{partnerTypes.map((type) => <li key={type}>{type}</li>)}</ul>
      </section>

      <section className="content-section muted-section">
        <p className="overline">Planned outreach</p>
        <h2>Conversations are not endorsements.</h2>
        <p>
          The Commonwealth Center for Fathers and Families and Kentucky Department
          for Community Based Services are organizations Village Strong Foundation
          plans to approach for guidance. They are not represented as official
          partners, funders, referral sources, or endorsers.
        </p>
        <p>
          A referral relationship will not be advertised until written criteria,
          data-sharing limits, safeguarding responsibilities, points of contact,
          complaint escalation, insurance, and termination terms are approved.
        </p>
      </section>

      <section className="page-actions">
        <Link className="foundation-button" href="/contact">Start a partnership conversation</Link>
      </section>
    </main>
  );
}
