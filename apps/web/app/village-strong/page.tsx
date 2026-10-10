import Link from "next/link";

const plannedAreas = [
  ["Caregiver engagement", "Resources and learning concepts intended to support parents and caregivers."],
  ["Child and adolescent development", "Developmentally informed guidance from birth through age 18."],
  ["Mentorship", "Exploration of safe, supportive relationships and positive youth development."],
  ["Community connections", "Potential partnerships and pathways to appropriate community resources."],
];

export default function VillageStrongPage() {
  return (
    <main className="vs">
      <header className="vs-header">
        <Link className="vs-brand" href="/"><img src="/village-strong-logo.jpeg" alt="" /><span><b>Village Strong</b><small>Family & Community Support</small></span></Link>
        <nav aria-label="Village Strong navigation">
          <a href="#purpose">Purpose</a>
          <a href="#focus">Planned focus</a>
          <a href="#partners">Partnerships</a>
          <Link href="/research">Research</Link>
        </nav>
        <Link className="vs-button compact" href="/">Foundation home</Link>
      </header>

      <section className="vs-hero">
        <div className="vs-hero-copy">
          <p className="vs-eyebrow">Family and community support</p>
          <h1>Building a Stronger Village <em>for Children and Families.</em></h1>
          <p>
            Village Strong is a proposed community and family-support initiative
            exploring caregiver resources, positive youth development, mentorship,
            and community partnerships.
          </p>
          <p className="development-badge">In Development - Not Currently Enrolling</p>
        </div>
        <div className="vs-hero-art">
          <div className="sun" />
          <div className="path path-blue" />
          <div className="path path-gold" />
          <img src="/village-strong-logo.jpeg" alt="Village Strong" />
        </div>
      </section>

      <section className="development-notice village-notice" aria-label="Village Strong development notice">
        <strong>Planning-stage initiative.</strong>
        <p>
          Activities and implementation details are being developed. No formal
          program enrollment, fixed course sequence, completion credential, or
          scheduled service is currently available.
        </p>
      </section>

      <section id="purpose" className="vs-statement">
        <p className="vs-eyebrow">Our purpose</p>
        <h2>A stronger village begins with stronger support.</h2>
        <p>
          Village Strong is exploring family-centered, culturally responsive, and
          trauma-aware approaches for parents, caregivers, mentors, educators,
          volunteers, youth workers, and community partners.
        </p>
      </section>

      <section id="focus" className="vs-path-section">
        <div className="section-heading">
          <div>
            <p className="vs-eyebrow">Planned areas of focus</p>
            <h2>What we are working to develop.</h2>
          </div>
          <p>These focus areas are goals under development, not a current course catalog or promise of services.</p>
        </div>
        <div className="pillar-grid four-up">
          {plannedAreas.map(([title, text], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="partners" className="vs-network simplified-network">
        <div className="network-copy">
          <p className="vs-eyebrow">Potential partners</p>
          <h2>Building relationships before building programs.</h2>
          <p>
            We welcome planning conversations with families, educators, mentors,
            researchers, and community organizations interested in responsible,
            accessible family support.
          </p>
          <a className="vs-button" href="mailto:darodriguez1274@gmail.com?subject=Village%20Strong%20partnership%20inquiry">Partnership inquiry</a>
        </div>
        <div className="partner-list" aria-label="Potential Village Strong partners">
          <span>Families and caregivers</span>
          <span>Educators</span>
          <span>Mentors</span>
          <span>Community organizations</span>
        </div>
      </section>

      <section className="goals-section village-goals">
        <p className="vs-eyebrow">Our goals</p>
        <h2>Support informed by development, relationships, and community.</h2>
        <p>No outcome, participation, or impact figures are claimed before implementation and evaluation.</p>
      </section>

      <section className="connect-section">
        <p className="vs-eyebrow">General interest</p>
        <h2>Contact our team.</h2>
        <p>Submitting an inquiry does not enroll you in a program, guarantee services, or reserve a future place.</p>
        <a className="vs-button" href="mailto:darodriguez1274@gmail.com?subject=Village%20Strong%20general%20inquiry">Learn more</a>
      </section>

      <footer className="vs-footer revised-footer">
        <div className="vs-brand inverse"><img src="/village-strong-logo.jpeg" alt="" /><span><b>Village Strong</b><small>Family & Community Support</small></span></div>
        <p>Programs in development. No formal enrollment or credentials currently offered.</p>
        <a href="mailto:darodriguez1274@gmail.com">darodriguez1274@gmail.com</a>
        <Link href="/">Foundation home</Link>
      </footer>
    </main>
  );
}
