const resourceGroups = [
  {
    title: "Immediate safety or crisis support",
    items: [
      ["Emergency services", "Call 911 when someone is in immediate danger."],
      ["988 Suicide & Crisis Lifeline", "Call or text 988 in the United States for immediate crisis support."],
    ],
  },
  {
    title: "Kentucky family and community resources",
    items: [
      ["Kentucky 211", "Use 211 to locate community services, food, housing, health, and family supports."],
      ["Kentucky Cabinet for Health and Family Services", "Use official Kentucky resources for family services and program information."],
    ],
  },
  {
    title: "Future FAMILY materials",
    items: [
      ["Reflection resources", "Original, permission-cleared reflection sheets and audio may be added after review."],
      ["Participant materials", "Any participant-only resources will remain unavailable until secure access and operating policies are approved."],
    ],
  },
] as const;

export default function ResourcesPage() {
  return (
    <main id="main-content" className="content-page">
      <section className="content-hero">
        <p className="overline">Resources</p>
        <h1>Start with appropriate, independent support.</h1>
        <p>
          This page identifies general resource categories while Village Strong and
          FAMILY remain in development. It is not a crisis service, clinical service,
          or substitute for qualified legal, medical, or mental-health assistance.
        </p>
      </section>

      <section className="content-section">
        <div className="info-grid">
          {resourceGroups.map((group) => (
            <article key={group.title}>
              <h2>{group.title}</h2>
              {group.items.map(([name, description]) => <div className="resource-item" key={name}><h3>{name}</h3><p>{description}</p></div>)}
            </article>
          ))}
        </div>
      </section>

      <section className="development-notice">
        <strong>Resource independence</strong>
        <p>
          Mentioning an organization or public service does not establish sponsorship,
          endorsement, partnership, or responsibility for its services. Verify current
          contact and eligibility information directly with the provider.
        </p>
      </section>
    </main>
  );
}
