import Link from "next/link";

const steps = [
  ["1", "Express interest", "Use the general contact channel without sending custody, clinical, child, or court-case details."],
  ["2", "Eligibility and orientation", "If a pilot is authorized, staff will explain fit, expectations, accessibility, confidentiality limits, and voluntary participation."],
  ["3", "Join a live cohort", "The proposed model uses closed, founder-led virtual groups with phone access and a regional in-person option."],
  ["4", "Use optional materials", "Original or permission-cleared reflections, audio, and short learning resources may supplement live sessions."],
  ["5", "Create an engagement plan", "Participants may identify safe, realistic goals and revisit them during optional follow-up."],
] as const;

const faqs = [
  ["Is enrollment open?", "No. The Kentucky pilot is still in development, and no cohort, schedule, or launch date has been approved."],
  ["What will it cost?", "Cost and funding have not been determined. No tuition or educational fee is currently being collected."],
  ["Do I need a computer?", "The proposed model includes mobile, telephone, printable, and low-bandwidth options, subject to final capacity."],
  ["Is FAMILY therapy or legal help?", "No. FAMILY is proposed as nonclinical fatherhood engagement and resource navigation, not therapy, diagnosis, legal representation, or custody evaluation."],
  ["Are referrals available?", "Future resource navigation may connect participants to independent qualified providers. No referral partnership is represented as active until an agreement exists."],
  ["How will privacy work?", "A future intake process will collect only necessary information through a protected system. Research consent, if ever offered, will remain separate from program participation."],
] as const;

export default function HowItWorksPage() {
  return (
    <main id="main-content" className="content-page">
      <section className="content-hero family-gradient">
        <p className="overline">FAMILY participation model</p>
        <h1>How the proposed Kentucky pilot would work.</h1>
        <p>
          FAMILY is planning a fathers-first hybrid model with live virtual
          participation, telephone access, regional in-person engagement, and
          supplemental self-paced materials.
        </p>
        <p className="development-badge light">Proposed Process - Enrollment Not Open</p>
      </section>

      <section className="content-section">
        <p className="overline">Five proposed steps</p>
        <h2>From initial inquiry to a personal engagement plan.</h2>
        <ol className="steps-list">
          {steps.map(([number, title, description]) => (
            <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></li>
          ))}
        </ol>
      </section>

      <section className="content-section muted-section">
        <p className="overline">Frequently asked questions</p>
        <h2>What is known and what remains undecided.</h2>
        <div className="faq-list">
          {faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
        </div>
      </section>

      <section className="development-notice">
        <strong>No enrollment or sensitive intake is available on this website.</strong>
        <p>General questions may be sent through the contact page. Do not send emergency, clinical, custody, child, or court-case information.</p>
      </section>

      <section className="page-actions">
        <Link className="foundation-button" href="/contact">General contact</Link>
        <Link className="secondary-button" href="/family">Return to FAMILY</Link>
      </section>
    </main>
  );
}
