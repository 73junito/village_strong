export default function PrivacyPage() {
  return (
    <main id="main-content" className="content-page policy-page">
      <section className="content-hero">
        <p className="overline">Privacy notice</p>
        <h1>Public website privacy and safe communication.</h1>
        <p>Last reviewed October 12, 2026. Program intake and research data collection are not active.</p>
      </section>

      <section className="content-section prose-section">
        <h2>Information this website is designed to receive</h2>
        <p>The public site provides informational pages and email links for general inquiries. It does not provide a participant account, program application, clinical intake, or research-response form.</p>

        <h2>Information you should not send</h2>
        <p>Do not send Social Security numbers, children&apos;s information, medical or mental-health details, custody records, court documents, research responses, passwords, or payment information through public email links.</p>

        <h2>Infrastructure and technical records</h2>
        <p>The website is delivered through Cloudflare Workers. Hosting and security services may process ordinary technical request data needed to deliver and protect the site. No participant records or research responses should be stored in source control or public deployment logs.</p>

        <h2>Future intake or research systems</h2>
        <p>Any future participant or research collection will require a separate notice describing purpose, authority, fields collected, access, retention, deletion, incident response, processors, and consent. Program participation and optional research consent will remain separate.</p>

        <h2>Questions</h2>
        <p>Email <a className="inline-link" href="mailto:darodriguez1274@gmail.com?subject=Privacy%20question">darodriguez1274@gmail.com</a> with general privacy questions. Do not include sensitive personal information.</p>
      </section>
    </main>
  );
}
