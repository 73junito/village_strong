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
    <main id="main-content" className="family">
      <section className="family-hero">
        <div className="family-shade" />
        <div className="family-hero-copy">
          <p className="family-eyebrow">Fatherhood engagement and education program</p>
          <h1>Leading Yourself.<br />Loving Your Family.<br /><em>Leaving a Legacy.</em></h1>
          <p>
            FAMILY is a proposed community-based fatherhood engagement initiative
            designed to help fathers understand barriers affecting their involvement,
            strengthen parenting and relationship skills, and connect with practical support.
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
          FAMILY welcomes adult expectant, resident, nonresident, married, single,
          separated, returning, and otherwise disengaged fathers. Planned activities
          include peer discussion, fatherhood education, personal action planning,
          and resource navigation. These goals describe work under development, not
          demonstrated program outcomes.
        </p>
      </section>

      <section className="delivery-section">
        <p className="family-eyebrow">Proposed hybrid access</p>
        <h2>Live connection with flexible ways to participate.</h2>
        <div className="info-grid">
          <article><h3>Live virtual</h3><p>Closed founder-led cohorts with a secure link, phone dial-in, and no routine recording.</p></article>
          <article><h3>Regional in person</h3><p>A future accessible gathering in the Elizabethtown-Glasgow-Columbia corridor, subject to venue and readiness.</p></article>
          <article><h3>Self-paced support</h3><p>Short original or permission-cleared audio, video, printable reflections, and action plans.</p></article>
          <article><h3>Resource navigation</h3><p>Brief nonclinical check-ins and referral information within defined boundaries.</p></article>
        </div>
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
        <div className="hero-actions"><Link className="family-button" href="/family/how-it-works">How it would work</Link><Link className="secondary-button" href="/contact">General contact</Link></div>
      </section>

    </main>
  );
}
