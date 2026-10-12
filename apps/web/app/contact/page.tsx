const email = "darodriguez1274@gmail.com";

export default function ContactPage() {
  return (
    <main id="main-content" className="content-page">
      <section className="content-hero">
        <p className="overline">Contact</p>
        <h1>General questions and partnership inquiries.</h1>
        <p>
          The pilot is not enrolling. This contact channel is for general planning,
          partnership, and accessibility questions only.
        </p>
      </section>

      <section className="content-section two-column">
        <div>
          <p className="overline">Email</p>
          <h2>Choose the safest subject for your inquiry.</h2>
          <p><a className="inline-link" href={`mailto:${email}`}>{email}</a></p>
        </div>
        <div className="contact-options">
          <a href={`mailto:${email}?subject=FAMILY%20general%20inquiry`}><strong>FAMILY general inquiry</strong><span>Questions about the proposed fatherhood initiative.</span></a>
          <a href={`mailto:${email}?subject=Village%20Strong%20partnership%20inquiry`}><strong>Partnership inquiry</strong><span>Planning conversations with community organizations.</span></a>
          <a href={`mailto:${email}?subject=Website%20accessibility%20request`}><strong>Accessibility request</strong><span>Request an alternative format or report a website barrier.</span></a>
        </div>
      </section>

      <section className="development-notice">
        <strong>Do not send sensitive or emergency information.</strong>
        <p>
          Do not email Social Security numbers, children&apos;s information, health or
          mental-health records, custody or court documents, research responses, or
          detailed family histories. This mailbox is not monitored as a crisis line.
          Call 911 for immediate danger or call or text 988 for crisis support.
        </p>
      </section>

      <section className="content-section muted-section">
        <p className="overline">Interest intake status</p>
        <h2>A protected participant-interest form is not yet active.</h2>
        <p>
          A future form will be opened only after privacy, retention, access,
          safeguarding, incident-response, and secure-system requirements are approved
          and tested. Sending an email does not apply, enroll, reserve a place, or
          provide consent for services or research.
        </p>
      </section>
    </main>
  );
}
