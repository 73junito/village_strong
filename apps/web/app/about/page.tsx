export default function AboutPage() {
  return (
    <main id="main-content" className="content-page">
      <section className="content-hero">
        <p className="overline">About Village Strong Foundation</p>
        <h1>One foundation supporting stronger family and community connections.</h1>
        <p>
          Village Strong Foundation is developing community-centered initiatives for
          children, caregivers, fathers, and families. FAMILY is the foundation&apos;s
          proposed fatherhood engagement initiative; Village Strong focuses on family
          and community support.
        </p>
        <p className="development-badge">Planning Phase - Not Currently Enrolling</p>
      </section>

      <section className="content-section two-column">
        <div>
          <p className="overline">Our working mission</p>
          <h2>Support responsibility, access, and safe family relationships.</h2>
        </div>
        <div>
          <p>
            Our working mission is to support fathers and families in understanding
            personal and environmental barriers, taking responsibility, accessing
            appropriate support, and building safe, meaningful relationships with
            their children and communities.
          </p>
          <p>
            Proposed services are nonclinical and community-based. They are not
            psychotherapy, diagnosis, custody evaluation, legal advice, accredited
            instruction, professional certification, or a guarantee of family or
            court outcomes.
          </p>
        </div>
      </section>

      <section className="content-section muted-section">
        <p className="overline">Organizational boundaries</p>
        <h2>Clear roles prevent misleading claims.</h2>
        <div className="info-grid">
          <article><h3>Village Strong Foundation</h3><p>Governance, partnerships, resource navigation, fundraising, and program administration.</p></article>
          <article><h3>FAMILY</h3><p>Proposed nonclinical fatherhood engagement, reflection, practical skill-building, personal goals, and peer connection.</p></article>
          <article><h3>Research</h3><p>Separate prospective evaluation and instrument-development work, subject to independent ethics determination and informed consent.</p></article>
        </div>
      </section>

      <section className="development-notice" aria-label="Status notice">
        <strong>Status and approval notice</strong>
        <p>
          The public website describes work under development. It does not claim
          government endorsement, state approval, accreditation, a public contract,
          demonstrated outcomes, or federal tax-exempt status. Any status claim will
          be published only after it is verified.
        </p>
      </section>
    </main>
  );
}
