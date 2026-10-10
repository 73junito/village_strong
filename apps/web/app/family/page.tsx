import Link from "next/link";

const pathways = [
  {
    status: "Proposed - Not Enrolling",
    title: "Fatherhood Engagement & Education",
    text:
      "Noncredit, community-focused personal and family development for fathers and caregivers. Topics may include parenting, communication, co-parenting, well-being, and connection.",
  },
  {
    status: "Conceptual - Not Enrolling",
    title: "FAMILY Facilitator Development",
    text:
      "Potential future preparation for individuals who may facilitate FAMILY activities. Training standards, hours, fees, assessment, and any internal recognition remain undecided and subject to regulatory review.",
  },
];

export default function FamilyPage() {
  return (
    <main className="family">
      <header className="family-header">
        <Link className="family-brand" href="/"><span className="family-mark">F</span><span><b>FAMILY</b><small>FATHERHOOD INITIATIVE</small></span></Link>
        <nav aria-label="FAMILY navigation">
          <a href="#purpose">Purpose</a>
          <a href="#pathways">Planned pathways</a>
          <a href="#development">Development</a>
          <Link href="/research">Research</Link>
        </nav>
        <Link className="family-button compact" href="/">Foundation home</Link>
      </header>

      <section className="family-hero">
        <div className="family-shade" />
        <div className="family-hero-copy">
          <p className="family-eyebrow">Fatherhood engagement and education program</p>
          <h1>Leading Yourself.<br />Loving Your Family.<br /><em>Leaving a Legacy.</em></h1>
          <p>
            FAMILY is a proposed fatherhood engagement and education initiative
            focused on paternal identity, father-child relationships, parenting
            knowledge, emotional well-being, and meaningful family involvement.
          </p>
          <p className="development-badge light">In Development - Not Currently Enrolling</p>
        </div>
      </section>

      <section className="development-notice family-notice" aria-label="FAMILY development notice">
        <strong>No pilot, enrollment, or credential is currently available.</strong>
        <p>
          The program is in development and has not yet been piloted or evaluated.
          Future activities remain subject to curriculum development, permissions,
          and applicable regulatory review.
        </p>
      </section>

      <section id="purpose" className="family-mission">
        <p className="family-eyebrow">Fathers Advancing Meaningful Identity, Leadership & Youth</p>
        <h2>Fatherhood learning designed around family connection.</h2>
        <p>
          FAMILY is exploring an evidence-informed approach to fatherhood engagement,
          parenting knowledge, paternal well-being, communication, co-parenting, and
          meaningful family involvement. These goals describe work under development,
          not demonstrated program outcomes.
        </p>
      </section>

      <section id="pathways" className="pathway-section">
        <div className="section-heading simple-heading">
          <div>
            <p className="family-eyebrow">Two planned pathways</p>
            <h2>Separate purposes. Separate regulatory questions.</h2>
          </div>
          <p>Neither pathway is currently accepting applications or participants.</p>
        </div>
        <div className="pathway-grid">
          {pathways.map((pathway) => (
            <article key={pathway.title}>
              <span>{pathway.status}</span>
              <h3>{pathway.title}</h3>
              <p>{pathway.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="development" className="curriculum-development">
        <div>
          <p className="family-eyebrow">Curriculum development</p>
          <h2>Original FAMILY materials with responsible review of established resources.</h2>
        </div>
        <div>
          <p>
            FAMILY&apos;s development process includes consideration of the 24:7 Dad®
            curriculum developed by National Fatherhood Initiative®, alongside original
            FAMILY materials.
          </p>
          <p>
            Any use or adaptation of third-party curriculum materials will be subject
            to applicable permissions and implementation requirements. Village Strong
            Foundation does not represent sponsorship, endorsement, partnership, or
            certification by National Fatherhood Initiative.
          </p>
        </div>
      </section>

      <section className="goals-section">
        <p className="family-eyebrow">Our goals</p>
        <h2>What FAMILY hopes to strengthen.</h2>
        <div className="goals-grid">
          <span>Father-child relationships</span>
          <span>Parenting knowledge</span>
          <span>Paternal well-being</span>
          <span>Family engagement</span>
        </div>
      </section>

      <section className="connect-section family-connect">
        <p className="family-eyebrow">General inquiries</p>
        <h2>Explore partnership opportunities.</h2>
        <p>Contacting us is not an application, enrollment, clinical intake, or promise of future services.</p>
        <a className="family-button" href="mailto:darodriguez1274@gmail.com?subject=FAMILY%20partnership%20inquiry">Contact our team</a>
      </section>

      <footer className="family-footer revised-footer">
        <div className="family-brand"><span className="family-mark">F</span><span><b>FAMILY</b><small>FATHERHOOD INITIATIVE</small></span></div>
        <p>Programs in development. No formal enrollment or credentials currently offered.</p>
        <a href="mailto:darodriguez1274@gmail.com">darodriguez1274@gmail.com</a>
        <Link href="/">Foundation home</Link>
      </footer>
    </main>
  );
}
