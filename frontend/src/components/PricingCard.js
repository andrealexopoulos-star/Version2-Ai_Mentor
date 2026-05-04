import React from 'react';
import { Link } from 'react-router-dom';

const AutoTopUpDetails = ({ tier, autoTopUp }) => (
  <details className="pricing-details">
    <summary>
      <span>Auto top-up details</span>
    </summary>
    <div className="pricing-details-content">
      {tier === 'lite' ? (
        <>
          <div className="pricing-details-note">
            <strong>No auto top-up on Lite.</strong> If you run out of tokens, you are prompted to upgrade to Growth.
          </div>
          <p>Want auto top-up? Move up to Growth ($69 AUD/mo) for 1,000,000 tokens and slider top-ups.</p>
        </>
      ) : (
        <>
          <div className="pricing-details-note">
            <strong>Default ON.</strong> When tokens hit zero, your slider amount automatically buys more.
          </div>
          <p><strong>Slider range:</strong> $20 to $5,000 AUD per top-up (default {autoTopUp.defaultAmount}).</p>
          <p><strong>{autoTopUp.exampleLabel}:</strong> {autoTopUp.exampleValue}</p>
          <p><strong>You control:</strong> turn off any time, set a monthly cap, and request a refund within 24 hours.</p>
        </>
      )}
    </div>
  </details>
);

export default function PricingCard({ plan, ctaTo, ctaLabel }) {
  return (
    <article className={`pricing-card ${plan.recommended ? 'pricing-card-recommended' : ''}`}>
      {plan.recommended ? <div className="pricing-card-badge">Recommended</div> : null}

      <p className={`pricing-card-kicker ${plan.recommended ? 'is-recommended' : ''}`}>{plan.kicker}</p>
      <h3>{plan.name}</h3>
      <p className="pricing-card-desc">{plan.description}</p>

      <div className="pricing-price-wrap">
        <span className="pricing-price">${plan.price}</span>
        <span className="pricing-price-period">AUD/month</span>
      </div>

      <div className={`pricing-includes ${plan.recommended ? 'is-recommended' : ''}`}>
        <div className="label">Includes</div>
        <div className="value">{plan.tokens} tokens / mo</div>
      </div>

      <ul>
        {plan.features.map((feature) => (
          <li key={feature}>
            <span className="tick" aria-hidden="true">
              ✓
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <Link
        className={`pricing-card-cta ${plan.recommended ? 'is-primary' : ''}`}
        to={ctaTo}
      >
        {ctaLabel}
      </Link>

      <AutoTopUpDetails tier={plan.id} autoTopUp={plan.autoTopUp} />
    </article>
  );
}
