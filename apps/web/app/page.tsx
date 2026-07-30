import Link from "next/link";

export default function GatewayPage() {
  return (
    <main className="gateway">
      <header className="gateway-header">
        <span className="gateway-kicker">Two missions. One stronger community.</span>
        <a href="mailto:hello@villagestrong.org">Contact</a>
      </header>
      <section className="gateway-intro">
        <p className="overline">Choose your destination</p>
        <h1>Support for every stage of the family journey.</h1>
        <p>
          Village Strong and FAMILY Foundation are distinct programs with their
          own purpose, experience, and identity.
        </p>
      </section>
      <section className="gateway-grid" aria-label="Program destinations">
        <Link className="gateway-card village-card" href="/village-strong">
          <div className="gateway-logo-wrap">
            <img src="/village-strong-logo.jpeg" alt="Village Strong" />
          </div>
          <div>
            <span className="card-label">Youth & family support</span>
            <h2>Village Strong</h2>
            <p>
              A coordinated village of families, mentors, educators, and
              community partners helping every child find their path.
            </p>
            <span className="text-link">Enter Village Strong <b>→</b></span>
          </div>
        </Link>
        <Link className="gateway-card family-card" href="/family">
          <div className="family-monogram" aria-hidden="true">
            <span>F</span>
          </div>
          <div>
            <span className="card-label">Fatherhood & leadership</span>
            <h2>FAMILY Foundation</h2>
            <p>
              Fathers Advancing Meaningful Identity, Leadership & Youth—building
              stronger fathers, stronger families, and brighter futures.
            </p>
            <span className="text-link">Enter FAMILY Foundation <b>→</b></span>
          </div>
        </Link>
      </section>
    </main>
  );
}
