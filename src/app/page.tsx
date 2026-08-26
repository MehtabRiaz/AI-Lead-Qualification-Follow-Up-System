import Link from "next/link";
import { LeadForm } from "@/components/lead-form";

export default function HomePage() {
  return (
    <main>
      <nav className="nav shell" aria-label="Primary navigation">
        <Link className="brand" href="/">
          Northstar<span>Growth</span>
        </Link>
        <div className="nav-links">
          <a href="#process">Process</a>
          <a href="#contact">Start a conversation</a>
          <Link href="/dashboard">Demo dashboard</Link>
        </div>
      </nav>

      <section className="hero shell">
        <div className="eyebrow">
          <span /> Performance marketing, built for clarity
        </div>
        <h1>
          Growth gets easier when the <em>signal</em> is clear.
        </h1>
        <p>
          Tell us where performance is stuck. We’ll review the commercial
          context, urgency, and fit—then recommend the most useful next
          conversation.
        </p>
        <div className="hero-actions">
          <a className="button primary" href="#contact">
            Share your challenge
          </a>
          <a className="text-link" href="#process">
            See how it works <span>→</span>
          </a>
        </div>
        <div className="trust-row">
          <span>Paid acquisition</span>
          <span>Growth strategy</span>
          <span>B2B · SaaS · E-commerce</span>
        </div>
      </section>

      <section className="process" id="process">
        <div className="shell section-grid">
          <div>
            <div className="kicker">A considered process</div>
            <h2>
              Automation for speed.
              <br />
              Judgment where it matters.
            </h2>
          </div>
          <div className="steps">
            <article>
              <b>01</b>
              <div>
                <h3>Submit the context</h3>
                <p>
                  Share the commercial facts, current challenge, and decision
                  timeline.
                </p>
              </div>
            </article>
            <article>
              <b>02</b>
              <div>
                <h3>Transparent qualification</h3>
                <p>
                  Explicit rules assess fit while AI structures qualitative
                  signals. Missing data is never guessed.
                </p>
              </div>
            </article>
            <article>
              <b>03</b>
              <div>
                <h3>The right next action</h3>
                <p>
                  Strong opportunities move quickly; uncertainty and risk stay
                  under human control.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="contact shell" id="contact">
        <div className="form-intro">
          <div className="kicker">Start here</div>
          <h2>What are you trying to improve?</h2>
          <p>
            This is a fictional portfolio experience. Please use mock
            information only—do not submit real personal or confidential data.
          </p>
        </div>
        <LeadForm />
      </section>

      <footer className="shell">
        <span>Northstar Growth · Portfolio demonstration</span>
        <Link href="/dashboard">Open internal demo →</Link>
      </footer>
    </main>
  );
}
