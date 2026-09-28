import Link from "next/link";

const catalogPath = "/course-catalog/Village_Strong_FAMILY_Course_Catalog_2026_2027.docx";

const courses = [
  ["FAM 101", "Foundations of Fatherhood Science", "Fatherhood through human development, family studies, parenting education, public health, and community practice."],
  ["FAM 110", "Father Identity Roles and Development", "Father identity, role expectations, life transitions, culture, strengths, and reflective practice."],
  ["FAM 120", "Child Development for Fathers and Father Figures", "Development from birth through age 18 applied to interaction, routines, play, learning, and guidance."],
  ["FAM 130", "Father Child Relationships and Communication", "Connection, listening, emotional availability, conflict repair, encouragement, and consistent communication."],
  ["FAM 140", "Coparenting Family Systems and Partnership", "Cooperative parenting, boundaries, caregiver communication, and child-centered decision making."],
  ["FAM 210", "Responsible Father Engagement and Family Stability", "Consistent involvement, caregiving responsibilities, resource navigation, and barriers to engagement."],
  ["FAM 220", "Fatherhood Education Facilitation and Community Practice", "Inclusive, evidence-informed parent education, facilitation, privacy, accessibility, and evaluation."],
  ["FAM 290", "Fatherhood Education Action Plan", "An applied plan connecting learner needs, objectives, activities, safeguards, resources, and evaluation."],
];

export default function FamilyPage() {
  return (
    <main className="family">
      <header className="family-header">
        <Link className="family-brand" href="/family"><span className="family-mark">F</span><span><b>FAMILY</b><small>FOUNDATION</small></span></Link>
        <nav aria-label="FAMILY Foundation navigation"><a href="#about">About Us</a><a href="#catalog">Course Catalog</a><a href="#impact">Our Impact</a><a href="#contact">Contact</a></nav>
        <a className="family-button compact" href="#give">Donate</a>
      </header>
      <section className="family-hero">
        <div className="family-shade" />
        <div className="family-hero-copy">
          <p className="family-eyebrow">Fatherhood Science and parent education</p>
          <h1>Strong Fathers.<br />Stronger Families.<br /><em>Brighter Futures.</em></h1>
          <p>We empower fathers to lead with purpose, strengthen their families, and guide the next generation toward confidence, character, and leadership.</p>
          <div><a className="family-button" href="#catalog">View Courses</a><a className="family-button outline" href="#give">Get Involved</a></div>
        </div>
      </section>
      <section id="about" className="family-mission"><p className="family-eyebrow">Our specialization</p><h2>Fatherhood Science grounded in parent education.</h2><p>FAMILY brings human development, family studies, parenting education, and community practice together to strengthen father engagement and father-child relationships.</p></section>
      <section id="catalog" className="catalog-section">
        <div className="catalog-heading">
          <p className="family-eyebrow">2026 to 2027 proposed course catalog</p>
          <h2>FAMILY Fatherhood Science program</h2>
          <p>An eight-course, 96-instructional-hour noncredit sequence aligned by subject matter with CIP 19.0712 Parent Education Services.</p>
          <div className="catalog-meta"><span>8 courses</span><span>96 instructional hours</span><span>CIP 19.0712</span><span>Noncredit</span></div>
        </div>
        <div className="catalog-course-grid">{courses.map(([code,title,text]) => <article className="catalog-course" key={code}><span>{code}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        <a className="family-button catalog-download" href={catalogPath} download>Download the complete Word catalog</a>
        <p className="catalog-disclosure">CIP references describe instructional subject matter only. FAMILY is not represented as an accredited postsecondary degree program and does not award college credit, professional licensure, or an occupational credential.</p>
      </section>
      <section id="impact" className="family-impact"><div><p className="family-eyebrow">Our impact</p><h2>Better fathers.<br />Better communities.<br />Better tomorrows.</h2></div><div className="family-stats"><span><strong>1,000+</strong>Fathers empowered</span><span><strong>500+</strong>Families strengthened</span><span><strong>800+</strong>Youth mentored</span></div><blockquote>“Because of this program, I’m a better dad, a better man, and my kids know they can count on me.”</blockquote></section>
      <section id="give" className="family-give"><div><p className="family-eyebrow">Be part of the movement</p><h2>Every father helped.<br />Every future changed.</h2></div><div><a href="#contact">Join a program <span>→</span></a><a href="#contact">Become a partner <span>→</span></a><a href="#contact">Volunteer <span>→</span></a><a href="#contact">Donate <span>→</span></a></div></section>
      <footer id="contact" className="family-footer"><div className="family-brand"><span className="family-mark">F</span><span><b>FAMILY</b><small>FOUNDATION</small></span></div><p>Fathers Advancing Meaningful Identity, Leadership & Youth.</p><a href="mailto:hello@familyfoundation.org">hello@familyfoundation.org</a><Link href="/">All Programs</Link></footer>
    </main>
  );
}
