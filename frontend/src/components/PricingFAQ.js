import React from 'react';

const FAQ_ITEMS = [
  {
    q: 'What exactly is an AI token?',
    a: 'An AI token is a unit of thinking. When BIQc answers a question, evaluates a signal, or generates a report, tokens are used to do that work.',
  },
  {
    q: 'Why is everything else free?',
    a: 'We only charge for AI thinking so your team can connect accounts, invite teammates, and export reports without friction.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. There are no lock-in contracts, and you can cancel from billing settings.',
  },
  {
    q: 'How does auto top-up work?',
    a: 'When monthly tokens are exhausted, BIQc can automatically add more based on your selected top-up amount. You can turn this off and set monthly caps.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. You can move between plans as your business needs change.',
  },
];

export default function PricingFAQ() {
  return (
    <section className="pricing-faq">
      <div className="pricing-container pricing-faq-inner">
        <h2>Frequently asked</h2>
        {FAQ_ITEMS.map((item) => (
          <details key={item.q} className="pricing-faq-item">
            <summary>
              <span>{item.q}</span>
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
