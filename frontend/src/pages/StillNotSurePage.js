import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import WebsiteLayout from '../components/website/WebsiteLayout';
import usePageMeta from '../hooks/usePageMeta';

const PATHWAYS = [
  {
    title: 'Match quiz',
    body: "Answer 5 short questions about your team, growth stage, and goals. We'll recommend Growth, Pro, or Business.",
    cta: 'Take the quiz',
    href: '/onboarding-decision',
  },
  {
    title: 'Calibration Scan',
    body: 'Preview what BIQc surfaces about your business before you subscribe. No paid subscription starts from this scan flow.',
    cta: 'Run a Calibration Scan',
    href: '/market/calibration',
  },
  {
    title: 'Compare plans',
    body: 'Open the full capacity comparison for users, AI allowance, sync history, and support.',
    cta: 'Compare plans',
    href: '/pricing#comparison',
  },
];

const StillNotSurePage = () => {
  usePageMeta({
    title: 'Still not sure? | BIQc',
    description: 'Pick the right BIQc path with quiz, calibration scan, or side-by-side plan comparison.',
  });

  return (
    <WebsiteLayout>
      <section className="pt-16 sm:pt-24 pb-10 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.08em] font-semibold mb-3" style={{ color: '#E85D00' }}>
            Need help choosing?
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold mb-4" style={{ color: 'var(--ink-display, #0A0A0A)' }}>
            Take the match quiz, run a Calibration Scan, or compare plans side-by-side.
          </h1>
          <p className="text-base sm:text-lg" style={{ color: 'var(--ink-secondary, #6B7280)' }}>
            Or book a call with a BIQc Specialist to confirm the right plan, users, integrations, AI capacity, and onboarding pathway for your business.
          </p>
        </div>
      </section>

      <section className="pb-12 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {PATHWAYS.map((pathway) => (
            <article
              key={pathway.title}
              className="rounded-2xl p-6 flex flex-col"
              style={{ border: '1px solid rgba(140,170,210,0.2)', background: 'rgba(255,255,255,0.75)' }}
            >
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ink-display, #0A0A0A)' }}>{pathway.title}</h2>
              <p className="text-sm mb-6 flex-1" style={{ color: 'var(--ink-secondary, #6B7280)' }}>{pathway.body}</p>
              <Link
                to={pathway.href}
                className="inline-flex items-center gap-2 text-sm font-semibold"
                style={{ color: '#E85D00' }}
              >
                {pathway.cta} <ArrowRight className="w-4 h-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto rounded-2xl p-6" style={{ border: '1px solid rgba(232,93,0,0.22)', background: 'rgba(232,93,0,0.06)' }}>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--ink-display, #0A0A0A)' }}>
            Prefer to talk first?
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--ink-secondary, #6B7280)' }}>
            Speak with a BIQc Specialist to confirm the right plan, users, integrations, AI capacity, and rollout pathway.
          </p>
          <div className="flex flex-wrap gap-3 mb-5">
            {[
              'No lock-in contract',
              'Australian/local specialist support',
              'Capacity-first plan recommendation',
            ].map((item) => (
              <span key={item} className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(10,10,10,0.04)', color: 'var(--ink-secondary, #6B7280)' }}>
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#16A34A' }} />
                {item}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/speak-with-local-specialist" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold" style={{ background: '#E85D00', color: '#FFFFFF' }}>
              Book a call with a BIQc Specialist
            </Link>
            <Link to="/subscribe" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold" style={{ border: '1px solid rgba(10,10,10,0.12)', color: 'var(--ink-display, #0A0A0A)' }}>
              Choose a plan <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </WebsiteLayout>
  );
};

export default StillNotSurePage;
