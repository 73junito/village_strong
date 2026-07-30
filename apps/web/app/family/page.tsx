import Link from "next/link";

const programs = [
  ["01", "Identity & Purpose", "Helping fathers define their values and the legacy they want to leave."],
  ["02", "Self-Awareness", "Building emotional intelligence, responsibility, and the confidence to grow."],
  ["03", "Fatherhood", "Practical tools to lead, nurture, protect, and remain present."],
  ["04", "Family Relationships", "Strengthening communication, trust, and healthy connection at home."],
  ["05", "Youth Leadership", "Developing resilient young leaders through mentorship and teamwork."],
  ["06", "Community Impact", "Turning stronger families into stronger neighborhoods through service."],
];

export default function FamilyPage() {
  return (
    <main className="family">
      <header className="family-header">
        <Link className="family-brand" href="/family"><span className="family-mark">F</span><span><b>FAMILY</b><small>FOUNDATION</small></span></Link>
        <nav aria-label="FAMILY Foundation navigation"><a href="#about">About Us</a><a href="#program">Our Program</a><a href="#impact">Our Impact</a><a href="#contact">Contact</a></nav>
        <a className="family-button compact" href="#give">Donate</a>
      </header>
      <section className="family-hero">
        <div className="family-shade" />
        <div className="family-hero-copy">
          <p className="family-eyebrow">Fathers advancing meaningful identity, leadership & youth</p>
          <h1>Strong Fathers.<br />Stronger Families.<br /><em>Brighter Futures.</em></h1>
          <p>We empower fathers to lead with purpose, strengthen their families, and guide the next generation toward confidence, character, and leadership.</p>
          <div><a className="family-button" href="#program">Our Program</a><a className="family-button outline" href="#give">Get Involved</a></div>
        </div>
      </section>
      <section id="about" className="family-mission"><p className="family-eyebrow">Our mission</p><h2>We empower fathers. We inspire youth.<br />We strengthen communities.</h2><p>Through intentional mentorship, practical leadership development, and shared experiences, FAMILY helps fathers become the leaders their families need.</p></section>
      <section id="program" className="family-program">
        <div className="family-program-intro"><p className="family-eyebrow">Our program</p><h2>Building stronger families from the inside out.</h2><p>Our six-part journey develops the whole person, the whole family, and the whole community.</p></div>
        <div className="family-program-grid">{programs.map(([n,title,text]) => <article key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p><a href="#contact">Learn more →</a></article>)}</div>
      </section>
      <section id="impact" className="family-impact"><div><p className="family-eyebrow">Our impact</p><h2>Better fathers.<br />Better communities.<br />Better tomorrows.</h2></div><div className="family-stats"><span><strong>1,000+</strong>Fathers empowered</span><span><strong>500+</strong>Families strengthened</span><span><strong>800+</strong>Youth mentored</span></div><blockquote>“Because of this program, I’m a better dad, a better man, and my kids know they can count on me.”</blockquote></section>
      <section id="give" className="family-give"><div><p className="family-eyebrow">Be part of the movement</p><h2>Every father helped.<br />Every future changed.</h2></div><div><a href="#contact">Join a program <span>→</span></a><a href="#contact">Become a partner <span>→</span></a><a href="#contact">Volunteer <span>→</span></a><a href="#contact">Donate <span>→</span></a></div></section>
      <footer id="contact" className="family-footer"><div className="family-brand"><span className="family-mark">F</span><span><b>FAMILY</b><small>FOUNDATION</small></span></div><p>Fathers Advancing Meaningful Identity, Leadership & Youth.</p><a href="mailto:hello@familyfoundation.org">hello@familyfoundation.org</a><Link href="/">All Programs</Link></footer>
    </main>
  );
}
