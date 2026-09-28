import Link from "next/link";

const catalogPath = "/course-catalog/Village_Strong_FAMILY_Course_Catalog_2026_2027.docx";

const pillars = [
  ["01", "A Safe Foundation", "Create stability, belonging, and the support every child needs to begin."],
  ["02", "A Guided Path", "Connect each young person with mentors, learning, and practical next steps."],
  ["03", "A Strong Future", "Build confidence, leadership, and the skills to thrive independently."],
];

const courses = [
  ["VS 101", "Foundations of Human and Child Development", "Developmental domains and the influence of biology, relationships, culture, and environment."],
  ["VS 110", "Prenatal Development Infancy and Attachment", "Prenatal influences, infant development, responsive caregiving, attachment, and early communication."],
  ["VS 120", "Early Childhood Development Birth to Age Five", "Play, language, self-regulation, early learning, routines, and family engagement."],
  ["VS 130", "Middle Childhood Development Ages Six to Eleven", "Learning, peer relationships, identity, executive function, school engagement, and resilience."],
  ["VS 140", "Adolescent Development Ages Twelve to Eighteen", "Puberty, identity, autonomy, relationships, decision making, digital life, and adult transitions."],
  ["VS 210", "Family Systems Culture and Community", "Children within family systems and community contexts, including culture, resources, and support."],
  ["VS 220", "Resilience Trauma Awareness and Child Wellbeing", "Protective factors, adversity, trauma-aware interaction, emotional safety, and referral boundaries."],
  ["VS 290", "Developmental Support Portfolio", "An applied portfolio of activities, communication resources, referrals, and implementation reflection."],
];

const partners = ["Families", "Mentors", "Educators", "Community Partners"];

export default function VillageStrongPage() {
  return (
    <main className="vs">
      <header className="vs-header">
        <Link className="vs-brand" href="/village-strong"><img src="/village-strong-logo.jpeg" alt="" /><span><b>Village Strong</b><small>Because every child deserves a village</small></span></Link>
        <nav aria-label="Village Strong navigation"><a href="#mission">Our Mission</a><a href="#path">The Path</a><a href="#catalog">Course Catalog</a><a href="#village">The Village</a></nav>
        <a className="vs-button compact" href="#join">Join the Village</a>
      </header>
      <section className="vs-hero">
        <div className="vs-hero-copy"><p className="vs-eyebrow">Childhood Science from birth through age 18</p><h1>Every child deserves <em>a village.</em></h1><p>We surround children and families with the people, tools, and opportunities they need to move from uncertainty to a strong future.</p><div className="vs-actions"><a className="vs-button" href="#catalog">View Courses</a><a className="vs-button secondary" href="#mission">See How It Works</a></div><div className="vs-trust">{partners.map((partner) => <span key={partner}>✓ {partner}</span>)}</div></div>
        <div className="vs-hero-art"><div className="sun" /><div className="path path-blue" /><div className="path path-gold" /><img src="/village-strong-logo.jpeg" alt="Village Strong community pathway" /><span className="float-card card-one"><b>Whole-child support</b><small>One connected village</small></span><span className="float-card card-two"><b>Purpose → Progress</b><small>A path built around each child</small></span></div>
      </section>
      <section id="mission" className="vs-statement"><p className="vs-eyebrow">Our field</p><h2>Human and child development from birth through age 18.</h2><p>Village Strong connects developmental science with family-centered, culturally responsive, trauma-aware support for parents, caregivers, mentors, volunteers, youth workers, and community professionals.</p></section>
      <section id="path" className="vs-path-section"><div className="section-heading"><div><p className="vs-eyebrow">The Village Strong path</p><h2>From supported to unstoppable.</h2></div><p>One coordinated journey, built around the strengths, needs, and goals of every child.</p></div><div className="pillar-grid">{pillars.map(([number,title,text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p><a href="#catalog">Explore the courses →</a></article>)}</div></section>
      <section id="catalog" className="catalog-section">
        <div className="catalog-heading"><p className="vs-eyebrow">2026 to 2027 proposed course catalog</p><h2>Village Strong human and child development program</h2><p>An eight-course, 96-instructional-hour noncredit sequence aligned by subject matter with CIP 19.0701 Human Development and Family Studies General.</p><div className="catalog-meta"><span>8 courses</span><span>96 instructional hours</span><span>CIP 19.0701</span><span>Noncredit</span></div></div>
        <div className="catalog-course-grid">{courses.map(([code,title,text]) => <article className="catalog-course" key={code}><span>{code}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        <a className="vs-button catalog-download" href={catalogPath} download>Download the complete Word catalog</a>
        <p className="catalog-disclosure">CIP references describe instructional subject matter only. Village Strong is not represented as an accredited postsecondary degree program and does not award college credit, professional licensure, or an occupational credential.</p>
      </section>
      <section id="village" className="vs-network"><div className="network-copy"><p className="vs-eyebrow">It takes a village</p><h2>One child. One plan. One connected team.</h2><p>We turn separate services into a coordinated circle of support—clear roles, shared goals, and progress everyone can see.</p><a className="vs-button" href="#join">Become a Partner</a></div><div className="orbit" aria-label="Village Strong support network"><div className="orbit-center">Child<br /><small>at the center</small></div>{partners.map((partner,index) => <span className={`orbit-item orbit-${index + 1}`} key={partner}>{partner}</span>)}</div></section>
      <section id="impact" className="vs-impact"><div><strong>1</strong><span>shared support plan</span></div><div><strong>360°</strong><span>whole-child perspective</span></div><div><strong>4</strong><span>connected partner groups</span></div><blockquote>“A strong future begins when a child knows an entire village believes in them.”</blockquote></section>
      <section id="join" className="vs-cta"><p className="vs-eyebrow">Build the village</p><h2>Choose the role only you can fill.</h2><div><a href="mailto:hello@villagestrong.org?subject=Family%20interest">I’m a Family <span>→</span></a><a href="mailto:hello@villagestrong.org?subject=Mentor%20interest">I’m a Mentor <span>→</span></a><a href="mailto:hello@villagestrong.org?subject=Partner%20interest">I’m a Partner <span>→</span></a></div></section>
      <footer className="vs-footer"><div className="vs-brand inverse"><img src="/village-strong-logo.jpeg" alt="" /><span><b>Village Strong</b><small>Because every child deserves a village</small></span></div><p>Manhattan, Kansas · hello@villagestrong.org</p><Link href="/">All Programs</Link></footer>
    </main>
  );
}
