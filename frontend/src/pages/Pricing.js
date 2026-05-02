import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import WebsiteLayout from '../components/website/WebsiteLayout';
import usePageMeta from '../hooks/usePageMeta';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';

const PLANS = [
  {
    id: 'growth',
    name: 'Growth',
    price: '$69',
    period: 'AUD / month',
    label: 'Most popular',
    summary: 'For solo operators and early-stage teams.',
    capacity: [
      '1 user included',
      '1,000,000 AI tokens / month per account',
      'Recent data sync history',
      'Email support',
    ],
    featured: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$199',
    period: 'AUD / month',
    label: 'Team growth',
    summary: 'For teams running weekly intelligence workflows.',
    capacity: [
      'Up to 5 users included',
      '5,000,000 AI tokens / month per account',
      'Extended data sync history',
      'Priority support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: '$349',
    period: 'AUD / month',
    label: 'Higher capacity',
    summary: 'For established teams needing deeper monthly capacity.',
    capacity: [
      'Up to 12 users included',
      '20,000,000 AI tokens / month per account',
      'Advanced data sync history',
      'Priority support',
    ],
  },
  {
    id: 'specialist',
    name: 'Specialist',
    price: 'Custom',
    period: '',
    label: 'Local rollout',
    summary: 'Custom commercial rollout with a BIQc Specialist.',
    capacity: [
      'Custom users and AI capacity',
      'Custom sync history planning',
      'Local specialist-led onboarding',
      'Commercial review and support plan',
    ],
  },
];

const COMPARE_ROWS = [
  ['Users included', '1', 'Up to 5', 'Up to 12', 'Custom'],
  ['Monthly AI capacity', '1,000,000', '5,000,000', '20,000,000', 'Custom'],
  ['Core BIQc intelligence', true, true, true, true],
  ['Data sync history', 'Recent', 'Extended', 'Advanced', 'Custom'],
  ['Australian/local support', 'Email', 'Priority', 'Priority', 'Dedicated specialist'],
];

const FAQS = [
  {
    q: 'What changes between plans?',
    a: 'All paid plans include the same BIQc core intelligence system. You choose based on team size, monthly AI capacity, sync history depth, and support level.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. You can move between plans from your existing billing flow. Capacity and support align to the selected plan.',
  },
  {
    q: 'Is support local?',
    a: 'Yes. BIQc includes Australian/local support reassurance, and Specialist plans include direct local specialist guidance.',
  },
];

const planCtaHref = (user, planId) => {
  if (planId === 'specialist') return '/speak-with-local-specialist';
  return user ? '/subscribe' : '/register-supabase';
};

const planCtaLabel = (planId) => {
  if (planId === 'specialist') return 'Talk to a Local Specialist';
  if (planId === 'growth') return 'Start with Growth';
  if (planId === 'business') return 'Choose Business';
  return 'Choose Pro';
};

const PlanCard = ({ plan, user }) => (
  <article
    className="rounded-2xl p-6 flex flex-col"
    style={{
      border: plan.featured ? '1px solid rgba(232,93,0,0.35)' : '1px solid rgba(140,170,210,0.16)',
      background: plan.featured ? 'rgba(232,93,0,0.04)' : 'rgba(255,255,255,0.72)',
    }}
  >
    <span
      className="inline-flex self-start mb-4 px-3 py-1 rounded-full text-[10px] uppercase font-semibold tracking-[0.08em]"
      style={{
        color: plan.featured ? '#E85D00' : 'var(--ink-secondary, #6B7280)',
        background: plan.featured ? 'rgba(232,93,0,0.12)' : 'rgba(148,163,184,0.2)',
      }}
    >
      {plan.label}
    </span>
    <h3 className="text-xl font-semibold mb-1" style={{ color: 'var(--ink-display, #0A0A0A)' }}>{plan.name}</h3>
    <div className="flex items-baseline gap-1 mb-3">
      <span className="text-4xl font-bold" style={{ color: 'var(--ink-display, #0A0A0A)' }}>{plan.price}</span>
      {plan.period ? <span className="text-sm" style={{ color: 'var(--ink-secondary, #6B7280)' }}>{plan.period}</span> : null}
    </div>
    <p className="text-sm mb-5" style={{ color: 'var(--ink-secondary, #6B7280)' }}>
      {plan.summary}
    </p>
    <ul className="space-y-2 mb-6 flex-1">
      {plan.capacity.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm" style={{ color: 'var(--ink, #111827)' }}>
          <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#16A34A]" />
          {item}
        </li>
      ))}
    </ul>
    <Link
      to={planCtaHref(user, plan.id)}
      className="w-full text-center py-3 rounded-lg text-sm font-semibold"
      style={{
        background: plan.featured ? '#E85D00' : 'var(--surface-sunken, #F1F5F9)',
        color: plan.featured ? '#FFFFFF' : 'var(--ink-display, #0A0A0A)',
      }}
    >
      {planCtaLabel(plan.id)}
    </Link>
  </article>
);

const FaqItem = ({ open, q, a, onToggle }) => (
  <div style={{ borderBottom: '1px solid rgba(140,170,210,0.2)' }}>
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left py-4 flex items-center justify-between gap-3"
    >
      <span className="font-semibold" style={{ color: 'var(--ink-display, #0A0A0A)' }}>{q}</span>
      <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--ink-secondary, #6B7280)' }} />
    </button>
    {open ? <p className="pb-4 text-sm" style={{ color: 'var(--ink-secondary, #6B7280)' }}>{a}</p> : null}
  </div>
);

export default function Pricing() {
  usePageMeta({
    title: 'Pricing — Plans for Every Business Stage',
    description: 'Same BIQc core intelligence, choose your capacity: Growth, Pro, Business, or Specialist.',
  });
  const { user } = useSupabaseAuth();
  const [showCompare, setShowCompare] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <WebsiteLayout>
      <section className="pt-16 sm:pt-24 pb-10 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-semibold mb-4" style={{ color: 'var(--ink-display, #0A0A0A)' }}>
            Same core intelligence, choose your capacity.
          </h1>
          <p className="text-base sm:text-lg" style={{ color: 'var(--ink-secondary, #6B7280)' }}>
            Every paid plan includes BIQc core intelligence. Plans scale by users, monthly AI capacity, sync history, and support.
          </p>
        </div>
      </section>

      <section className="pb-14 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {PLANS.map((plan) => <PlanCard key={plan.id} plan={plan} user={user} />)}
        </div>
      </section>

      <section className="px-6 pb-12">
        <div className="max-w-[980px] mx-auto rounded-2xl p-6" style={{ border: '1px solid rgba(140,170,210,0.16)', background: 'rgba(248,250,252,0.8)' }}>
          <p className="text-xs uppercase tracking-[0.08em] font-semibold mb-2" style={{ color: '#E85D00' }}>
            Top-up at launch hold
          </p>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ink-display, #0A0A0A)' }}>
            Top-up is informational only right now.
          </h2>
          <p className="text-sm mb-3" style={{ color: 'var(--ink-secondary, #6B7280)' }}>
            Planned top-up reference: 250,000 AI tokens for $19 AUD. Live purchase is disabled until billing activation is approved.
          </p>
          <Link to="/speak-with-local-specialist" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: '#E85D00' }}>
            Talk to a Local Specialist <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <section className="py-12 px-4 sm:px-6" style={{ borderTop: '1px solid rgba(140,170,210,0.16)' }}>
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-semibold mb-2" style={{ color: 'var(--ink-display, #0A0A0A)' }}>
              Plan comparison
            </h2>
            <button
              type="button"
              onClick={() => setShowCompare((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ border: '1px solid rgba(140,170,210,0.2)', color: 'var(--ink-display, #0A0A0A)' }}
            >
              {showCompare ? 'Hide comparison' : 'Show comparison'}
              <ChevronDown className={`w-4 h-4 transition-transform ${showCompare ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {showCompare ? (
            <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(140,170,210,0.2)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Capacity', 'Growth', 'Pro', 'Business', 'Specialist'].map((title) => (
                      <th key={title} className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--ink-display, #0A0A0A)' }}>
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map(([label, growth, pro, business, specialist]) => (
                    <tr key={label} style={{ borderTop: '1px solid rgba(140,170,210,0.12)' }}>
                      <td className="px-4 py-3" style={{ color: 'var(--ink-display, #0A0A0A)' }}>{label}</td>
                      {[growth, pro, business, specialist].map((value, idx) => (
                        <td key={`${label}-${idx}`} className="px-4 py-3" style={{ color: 'var(--ink-secondary, #6B7280)' }}>
                          {value === true ? 'Included' : value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      <section className="py-12 px-6" style={{ borderTop: '1px solid rgba(140,170,210,0.16)' }}>
        <div className="max-w-4xl mx-auto rounded-2xl p-6" style={{ background: 'rgba(232,93,0,0.05)', border: '1px solid rgba(232,93,0,0.2)' }}>
          <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--ink-display, #0A0A0A)' }}>
            Prefer a guided setup?
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--ink-secondary, #6B7280)' }}>
            Talk to a local specialist to map plan capacity to your workflow, integrations, and rollout timing.
          </p>
          <Link to="/speak-with-local-specialist" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold" style={{ background: '#E85D00', color: '#FFFFFF' }}>
            Speak with a Local Specialist <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <section className="py-14 px-6" style={{ borderTop: '1px solid rgba(140,170,210,0.16)' }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-5" style={{ color: 'var(--ink-display, #0A0A0A)' }}>
            Frequently asked questions
          </h2>
          {FAQS.map((item, idx) => (
            <FaqItem
              key={item.q}
              open={openFaq === idx}
              q={item.q}
              a={item.a}
              onToggle={() => setOpenFaq(openFaq === idx ? -1 : idx)}
            />
          ))}
        </div>
      </section>
    </WebsiteLayout>
  );
}
