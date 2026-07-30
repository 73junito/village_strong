import Link from "next/link";

const pillars = [
  ["01", "A Safe Foundation", "Create stability, belonging, and the support every child needs to begin."],
  ["02", "A Guided Path", "Connect each young person with mentors, learning, and practical next steps."],
  ["03", "A Strong Future", "Build confidence, leadership, and the skills to thrive independently."],
];

const partners = ["Families", "Mentors", "Educators", "Community Partners"];

export default function VillageStrongPage() {
  return (
    <main className="vs">
      <header className="vs-header">
        <Link className="vs-brand" href="/village-strong">
          <img src="/village-strong-logo.jpeg" alt="" />
          <span><b>Village Strong</b><small>Because every child deserves a village</small></span>
        </Link>
        <nav aria-label="Village Strong navigation">
          <a href="#mission">Our Mission</a>
          <a href="#path">The Path</a>
          <a href="#village">The Village</a>
          <a href="#impact">Impact</a>
        </nav>
        <a className="vs-button compact" href="#join">Join the Village</a>
      </header>

      <section className="vs-hero">
        <div className="vs-hero-copy">
          <p className="vs-eyebrow">A community-powered pathway for young people</p>
          <h1>Every child deserves <em>a village.</em></h1>
          <p>
            We surround children and families with the people, tools, and
            opportunities they need to move from uncertainty to a strong future.
          </p>
          <div className="vs-actions">
            <a className="vs-button" href="#join">Find Your Path</a>
            <a className="vs-button secondary" href="#mission">See How It Works</a>
          </div>
          <div className="vs-trust">
            {partners.map((partner) => <span key={partner}>✓ {partner}</span>)}
          </div>
        </div>
        <div className="vs-hero-art">
          <div className="sun" />
          <div className="path path-blue" />
          <div className="path path-gold" />
          <img src="/village-strong-logo.jpeg" alt="Village Strong community pathway" />
          <span className="float-card card-one"><b>Whole-child support</b><small>One connected village</small></span>
          <span className="float-card card-two"><b>Purpose → Progress</b><small>A path built around each child</small></span>
        </div>
      </section>

      <section id="mission" className="vs-statement">
        <p className="vs-eyebrow">Our promise</p>
        <h2>No child should have to navigate life alone.</h2>
        <p>
          Village Strong brings the right people around the table, creates a
          clear plan, and helps each young person take meaningful steps forward.
        </p>
      </section>

      <section id="path" className="vs-path-section">
        <div className="section-heading">
          <div><p className="vs-eyebrow">The Village Strong path</p><h2>From supported to unstoppable.</h2></div>
          <p>One coordinated journey, built around the strengths, needs, and goals of every child.</p>
        </div>
        <div className="pillar-grid">
          {pillars.map(([number, title, text]) => (
            <article key={number}>
              <span>{number}</span><h3>{title}</h3><p>{text}</p><a href="#join">Explore this stage →</a>
            </article>
          ))}
        </div>
      </section>

      <section id="village" className="vs-network">
        <div className="network-copy">
          <p className="vs-eyebrow">It takes a village</p>
          <h2>One child. One plan. One connected team.</h2>
          <p>We turn separate services into a coordinated circle of support—clear roles, shared goals, and progress everyone can see.</p>
          <a className="vs-button" href="#join">Become a Partner</a>
        </div>
        <div className="orbit" aria-label="Village Strong support network">
          <div className="orbit-center">Child<br /><small>at the center</small></div>
          {partners.map((partner, index) => <span className={`orbit-item orbit-${index + 1}`} key={partner}>{partner}</span>)}
        </div>
      </section>

      <section id="impact" className="vs-impact">
        <div><strong>1</strong><span>shared support plan</span></div>
        <div><strong>360°</strong><span>whole-child perspective</span></div>
        <div><strong>4</strong><span>connected partner groups</span></div>
        <blockquote>“A strong future begins when a child knows an entire village believes in them.”</blockquote>
      </section>

      <section id="join" className="vs-cta">
        <p className="vs-eyebrow">Build the village</p>
        <h2>Choose the role only you can fill.</h2>
        <div>
          <a href="mailto:hello@villagestrong.org?subject=Family%20interest">I’m a Family <span>→</span></a>
          <a href="mailto:hello@villagestrong.org?subject=Mentor%20interest">I’m a Mentor <span>→</span></a>
          <a href="mailto:hello@villagestrong.org?subject=Partner%20interest">I’m a Partner <span>→</span></a>
        </div>
      </section>

      <footer className="vs-footer">
        <div className="vs-brand inverse"><img src="/village-strong-logo.jpeg" alt="" /><span><b>Village Strong</b><small>Because every child deserves a village</small></span></div>
        <p>Manhattan, Kansas · hello@villagestrong.org</p>
        <Link href="/">All Programs</Link>
      </footer>
    </main>
  );
}
