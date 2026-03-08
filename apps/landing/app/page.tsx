import Image from 'next/image';

const features = [
  {
    id: '01',
    title: 'Driver-First Ride Hailing',
    body: 'Goods-only ride hailing that cuts driver idle time and increases completed trips per day.'
  },
  {
    id: '02',
    title: 'Seamless Customer Journey',
    body: 'Quick booking, live tracking, and clear trip status updates from request to delivery.'
  },
  {
    id: '03',
    title: 'Built Around Driver Pain Points',
    body: 'Simple onboarding, transparent earnings, and low-friction trip handling for daily operations.'
  }
];

const flow = [
  {
    step: 'Request',
    title: 'Customer requests a goods ride',
    body: 'Pickup, drop, vehicle fit, and price are confirmed in one smooth booking flow.'
  },
  {
    step: 'Assign',
    title: 'Best nearby driver gets matched',
    body: 'Dispatch uses availability, route ETA, and acceptance logic to assign reliably.'
  },
  {
    step: 'Deliver',
    title: 'Trip completes with live visibility',
    body: 'Driver and customer stay synced through loading, transit, and delivery completion.'
  }
];

const plans = [
  {
    name: 'Go',
    fee: 'INR 500 / month',
    detail: 'For individual drivers'
  },
  {
    name: 'Pro',
    fee: 'INR 1000 / month',
    detail: 'For high-frequency drivers'
  },
  {
    name: 'Enterprise',
    fee: 'Contact sales',
    detail: 'For fleets and enterprise contracts'
  }
];

export default function LandingPage() {
  return (
    <main className="page">
      <div className="cosmos-layer" aria-hidden="true" />
      <div className="scan-grid" aria-hidden="true" />
      <div className="aurora a1" aria-hidden="true" />
      <div className="aurora a2" aria-hidden="true" />
      <div className="aurora a3" aria-hidden="true" />

      <header className="topbar fade-in-up">
        <a className="brand" href="#">
          <Image src="/brand/qargo-logo.png" alt="QARGO logo" width={92} height={76} className="brand-logo-nav" priority />
          <div>
            <p className="brand-word">QARGO</p>
            <p className="brand-tag">simply deliver</p>
          </div>
        </a>
        <nav className="nav-links">
          <a href="#platform">Platform</a>
          <a href="#flow">Flow</a>
          <a href="#pricing">Pricing</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <section className="hero" id="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-ring r1" aria-hidden="true" />
        <div className="hero-ring r2" aria-hidden="true" />
        <div className="hero-ring r3" aria-hidden="true" />
        <div className="hero-line" aria-hidden="true" />

        <div className="hero-content">
          <Image
            src="/brand/qargo-logo.png"
            alt="QARGO simply deliver"
            width={420}
            height={420}
            className="brand-logo-hero fade-in-up delay-1"
            priority
          />
          <p className="kicker fade-in-up delay-1">India&apos;s first driver-centric goods ride-hailing platform</p>
          <h1 className="fade-in-up delay-2">QARGO</h1>
          <p className="tagline fade-in-up delay-3">simply deliver</p>
          <p className="hero-copy fade-in-up delay-4">
            We understand what drivers feel on the road every day, and we built QARGO around those realities
            while keeping booking, tracking, and delivery seamless for customers.
          </p>
          <div className="actions fade-in-up delay-5">
            <a className="btn solid" href="#contact">
              Get Product Demo
            </a>
            <a className="btn ghost" href="#pricing">
              View Plans
            </a>
          </div>

          <div className="hero-metrics fade-in-up delay-6">
            <article>
              <span>Scale target</span>
              <strong>100k+ drivers</strong>
            </article>
            <article>
              <span>Dispatch heartbeat</span>
              <strong>5s updates</strong>
            </article>
            <article>
              <span>Ops readiness</span>
              <strong>24x7</strong>
            </article>
          </div>
        </div>
      </section>

      <section id="platform" className="band section-platform">
        <div className="section-head fade-in-up">
          <p className="eyebrow">Core Platform</p>
          <h2>Built from driver reality, not from boardroom assumptions.</h2>
        </div>
        <div className="feature-list">
          {features.map((feature, index) => (
            <article key={feature.title} className={`feature-row fade-in-up delay-${index + 1}`}>
              <p className="feature-id">{feature.id}</p>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="flow" className="band section-flow">
        <div className="section-head fade-in-up">
          <p className="eyebrow">Flow</p>
          <h2>From request to delivery, without friction.</h2>
        </div>
        <ol className="timeline">
          {flow.map((item, index) => (
            <li key={item.step} className={`fade-in-up delay-${index + 1}`}>
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <p className="timeline-step">{item.step}</p>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="pricing" className="band section-pricing">
        <div className="section-head fade-in-up">
          <p className="eyebrow">Driver Subscription</p>
          <h2>Simple plans with a 90-day free start.</h2>
          <p className="note">Drivers keep 100% ride earnings during the free window.</p>
        </div>
        <div className="pricing-lines">
          {plans.map((plan, index) => (
            <article key={plan.name} className={`pricing-line fade-in-up delay-${index + 1}`}>
              <h3>{plan.name}</h3>
              <p className="price">{plan.fee}</p>
              <p>{plan.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="band cta fade-in-up">
        <p className="eyebrow">Launch QARGO</p>
        <h2>Launch your goods ride-hailing network fast.</h2>
        <p>We support driver onboarding, dispatch operations, and city launch readiness.</p>
        <div className="actions">
          <a className="btn solid" href="mailto:hello@qargo.in?subject=QARGO%20Launch%20Demo">
            Contact Team
          </a>
          <a className="btn ghost" href="tel:+919844259899">
            Call 9844259899
          </a>
        </div>
      </section>

      <footer className="footer">
        <span>QARGO</span>
        <span>Copyright {new Date().getFullYear()} QARGO Logistics</span>
      </footer>
    </main>
  );
}
