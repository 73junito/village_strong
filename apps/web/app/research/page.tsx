const concepts = [
  {
    name: "FRI",
    description: "A proposed fatherhood-related measurement concept under development.",
  },
  {
    name: "EFAS",
    description: "A proposed concept for exploring experiences of paternal adjustment.",
  },
  {
    name: "PPARS",
    description: "A proposed concept related to paternal well-being and adjustment research.",
  },
];

const methods = [
  {
    step: "1",
    name: "Construct development",
    description:
      "Define each construct through literature review, father and caregiver perspectives, and clear boundaries between related concepts.",
  },
  {
    step: "2",
    name: "Item development",
    description:
      "Create broad draft item pools, review reading level and inclusivity, and document the rationale for each proposed item.",
  },
  {
    step: "3",
    name: "Expert content review",
    description:
      "Invite qualified experts and people with relevant lived experience to evaluate relevance, clarity, cultural fit, and domain alignment.",
  },
  {
    step: "4",
    name: "Cognitive interviews",
    description:
      "Examine how fathers understand each item, choose responses, and experience wording before any larger pilot study.",
  },
  {
    step: "5",
    name: "Pilot administration",
    description:
      "Use an approved protocol, informed consent, privacy safeguards, and de-identified data to examine feasibility and item performance.",
  },
  {
    step: "6",
    name: "Psychometric validation",
    description:
      "Evaluate factor structure, reliability, convergent and discriminant validity, measurement invariance, and responsiveness in appropriate samples.",
  },
  {
    step: "7",
    name: "Governance and dissemination",
    description:
      "Publish transparent scoring guidance, ethical-use limits, revision history, and evidence only after validation supports interpretation.",
  },
];

export default function ResearchPage() {
  return (
    <main id="main-content" className="research">
      <section className="research-hero">
        <p className="research-eyebrow">Fatherhood Research & Evaluation</p>
        <h1>Advancing Understanding of Fatherhood.</h1>
        <p>
          Our proposed research and evaluation work seeks to better understand
          paternal adjustment, father well-being, and experiences across the
          transition to and practice of fatherhood.
        </p>
        <p className="development-badge light">Research and instruments in development</p>
      </section>

      <section className="development-notice research-notice">
        <strong>No validated measures or study findings are currently claimed.</strong>
        <p>
          The concepts below are developmental. They are not diagnostic or clinical
          instruments, and no effectiveness claims or completed research outcomes
          are available.
        </p>
      </section>

      <section id="vision" className="research-section split-section">
        <div>
          <p className="research-eyebrow">Research vision</p>
          <h2>Questions before conclusions.</h2>
        </div>
        <div>
          <p>
            Future work may examine paternal identity, adjustment, emotional
            well-being, father-child relationships, family engagement, and the
            implementation of developing programs.
          </p>
          <p>
            Pilot evaluation is a future goal, not a completed study. Research
            recruitment will not begin without an appropriate protocol, informed
            consent, privacy protections, and ethics review.
          </p>
        </div>
      </section>

      <section id="concepts" className="research-section">
        <p className="research-eyebrow">Proposed measurement development</p>
        <h2>Concepts under development.</h2>
        <div className="concept-grid">
          {concepts.map((concept) => (
            <article key={concept.name}>
              <span>{concept.name}</span>
              <p>{concept.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="methods" className="research-section">
        <p className="research-eyebrow">Research methods</p>
        <h2>A staged development and validation process.</h2>
        <p>
          The proposed FRI, PPARS, and EFAS instruments will move through the
          following stages before any score interpretation or public-use claim is
          considered established.
        </p>
        <div className="concept-grid">
          {methods.map((method) => (
            <article key={method.step}>
              <span>{method.step}</span>
              <h3>{method.name}</h3>
              <p>{method.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="ethics" className="research-section ethics-section">
        <div>
          <p className="research-eyebrow">Research ethics</p>
          <h2>Privacy, consent, and appropriate review come first.</h2>
        </div>
        <div>
          <p>
            General website inquiries should not include sensitive family histories,
            children&apos;s information, clinical details, or research responses.
          </p>
          <p>
            Village Strong Foundation will distinguish educational inquiry,
            program-interest communication, and research participation before
            collecting data for any future study.
          </p>
          <p>
            No participant information or research responses are collected through
            this public page.
          </p>
        </div>
      </section>

      <section className="connect-section research-connect">
        <p className="research-eyebrow">Research and evaluation inquiries</p>
        <h2>Start a planning conversation.</h2>
        <p>Contact is for general professional inquiry only and is not research enrollment or consent.</p>
        <a className="research-button" href="mailto:darodriguez1274@gmail.com?subject=Fatherhood%20research%20inquiry">Contact our team</a>
      </section>

    </main>
  );
}
