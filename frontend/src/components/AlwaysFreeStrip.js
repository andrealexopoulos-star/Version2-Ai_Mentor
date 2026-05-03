import React from 'react';

const ALWAYS_FREE_ITEMS = [
  'Unlimited integrations',
  'Unlimited team seats',
  'PDF / CSV / Excel exports',
  'Generating reports',
  'Activating signal slots',
  'Requesting history backfill',
];

export default function AlwaysFreeStrip() {
  return (
    <section className="always-free-strip">
      <div className="pricing-container">
        <div className="always-free-heading">
          <p className="always-free-pill">Always free across every plan</p>
          <h2>Connect everything. Invite everyone. Export anything.</h2>
          <p>
            BIQc only charges for the AI thinking we do for you. Connecting accounts, adding teammates, and
            exporting reports never costs a token.
          </p>
        </div>
        <div className="always-free-grid">
          {ALWAYS_FREE_ITEMS.map((item) => (
            <div key={item} className="always-free-tile">
              <div>{item}</div>
              <span>FREE</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
