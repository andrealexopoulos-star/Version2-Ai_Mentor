import React from 'react';
import { Link } from 'react-router-dom';

export default function PremiumServices() {
  return (
    <section className="premium-services">
      <div className="pricing-container">
        <div className="premium-services-heading">
          <p className="premium-pill">Premium services on demand</p>
          <h2>Need more than the AI alone?</h2>
          <p>Available across all plans. Pay only when you use them.</p>
        </div>

        <div className="premium-services-grid">
          <article className="premium-card">
            <p className="premium-kicker">1-hour with a senior strategist</p>
            <h3>Specialist strategy session</h3>
            <table>
              <tbody>
                <tr>
                  <td>Lite plan</td>
                  <td>$250 / session</td>
                </tr>
                <tr>
                  <td>Growth plan</td>
                  <td>$250 / session</td>
                </tr>
                <tr className="highlight">
                  <td>Pro plan</td>
                  <td>$200 / extra (1/qtr included)</td>
                </tr>
                <tr className="highlight">
                  <td>Business plan</td>
                  <td>$200 / extra (onboarding included)</td>
                </tr>
              </tbody>
            </table>
            <p className="premium-copy">
              Book a 60-minute deep dive with a BIQc strategist. Bring a problem, leave with a plan.
            </p>
          </article>

          <article className="premium-card">
            <p className="premium-kicker">Bespoke intelligence built for you</p>
            <h3>Custom signal builds</h3>
            <table>
              <tbody>
                <tr>
                  <td>Growth plan</td>
                  <td>From $499 + From $5/mo per signal</td>
                </tr>
                <tr>
                  <td>Pro plan</td>
                  <td>From $399 + From $5/mo per signal</td>
                </tr>
                <tr>
                  <td>Business plan</td>
                  <td>From $299 + From $5/mo per signal</td>
                </tr>
              </tbody>
            </table>
            <p className="premium-copy">
              Need a unique signal? We can build it for your business, tied to your thresholds and decisions.
            </p>
          </article>
        </div>

        <div className="premium-footer-cta">
          <Link to="/speak-with-local-specialist">Talk to a specialist about premium services</Link>
        </div>
      </div>
    </section>
  );
}
