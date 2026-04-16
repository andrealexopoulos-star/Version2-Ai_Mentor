/**
 * TrustLandingPage — "Trust & Security" marketing page.
 *
 * Sections: Hero, Trust Pillars (4), Legal Documents (6),
 * Compliance Badges (4), Data Handling (4 FAQ cards), CTA.
 * Uses WebsiteLayout wrapper. No auth required.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { Shield, Lock, Eye, FileText, ArrowRight, MapPin, Brain, Scale } from 'lucide-react';
/* design tokens consumed via CSS custom properties — see liquid-steel-tokens.css */

/* ── Trust Pillars ── */
const PILLARS = [
  {
    icon: <MapPin className="w-5 h-5" />,
    title: 'Australian Data Sovereignty',
    description: 'All data hosted in Sydney and Melbourne. No offshore processing. Full audit trail for every access event, ensuring your information never leaves Australian jurisdiction.',
  },
  {
    icon: <Lock className="w-5 h-5" />,
    title: 'Encryption & Security',
    description: 'AES-256 encryption at rest, TLS 1.3 in transit. Row-level security ensures tenant isolation. Our infrastructure is aligned with SOC 2 Type II standards.',
  },
  {
    icon: <Scale className="w-5 h-5" />,
    title: 'Privacy & Compliance',
    description: 'Fully compliant with the Australian Privacy Act and Australian Privacy Principles. GDPR-ready for international clients. Data Processing Agreement available on request.',
  },
  {
    icon: <Brain className="w-5 h-5" />,
    title: 'AI Transparency',
    description: 'We never train on your data. Every AI output comes with full explainability. Our AI Learning Guarantee is a binding commitment to protect your intellectual property.',
  },
];

/* ── Legal Documents ── */
const LEGAL_DOCS = [
  { icon: FileText, title: 'Terms of Service', path: '/trust/terms', summary: 'The agreement governing your use of the BIQc platform and services.' },
  { icon: Eye, title: 'Privacy Policy', path: '/trust/privacy', summary: 'How we collect, use, and protect your personal information.' },
  { icon: Lock, title: 'Data Processing Agreement', path: '/trust/dpa', summary: 'Contractual terms for how we process data on your behalf.' },
  { icon: Shield, title: 'Security Disclosure', path: '/trust/security', summary: 'Our responsible disclosure policy and how to report vulnerabilities.' },
  { icon: Brain, title: 'AI Learning Guarantee', path: '/trust/ai-learning-guarantee', summary: 'Our binding commitment: your data is never used for AI model training.' },
  { icon: FileText, title: 'Enterprise Terms', path: '/trust/terms', summary: 'Custom licensing and service agreements for enterprise customers.' },
];

/* ── Compliance Badges ── */
const BADGES = [
  'Australian Privacy Principles',
  'AES-256 Encryption',
  'TLS 1.3 In Transit',
  'SOC 2 Aligned',
];

/* ── Data Handling FAQ ── */
const DATA_FAQ = [
  {
    q: 'What data we collect',
    a: 'We collect only the data necessary to deliver and improve BIQc:',
    bullets: [
      'Account information (name, email, company)',
      'Business data you connect via integrations',
      'Usage analytics (anonymised and aggregated)',
      'Support communications',
    ],
  },
  {
    q: 'How your data is used',
    a: 'Your connected business data is used exclusively to generate insights for your organisation. We never share, sell, or use your data for advertising. Aggregated usage patterns help us improve the product experience.',
  },
  {
    q: 'Data retention policy',
    a: 'Active account data is retained for the duration of your subscription. Upon cancellation, data is retained for 30 days to allow reactivation, then permanently deleted. Backups are purged within 90 days of account closure.',
  },
  {
    q: 'Your deletion rights',
    a: 'You can request full data deletion at any time. We will remove all personal and business data within 14 business days and provide written confirmation. This includes data in backups and logs.',
  },
];

const cardBg = 'var(--surface)';
const cardBorder = '1px solid var(--border)';

export default function TrustLandingPage() {
  return (
    <WebsiteLayout>
      {/* Hero */}
      <section className="py-20 md:py-24 text-center px-6"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, var(--steel-highlight) 0%, transparent 60%), linear-gradient(180deg, var(--canvas) 0%, var(--surface-tint) 100%)' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-[48px] font-bold leading-[1.15] tracking-tight mb-4"
            style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)', letterSpacing: 'var(--ls-display)' }}>
            Trust & Security
          </h1>
          <p className="text-lg max-w-[520px] mx-auto leading-relaxed"
            style={{ color: 'var(--ink-secondary)' }}>
            Your data is protected by Australian-grade security, privacy, and compliance standards.
          </p>
        </div>
      </section>

      {/* Trust Pillars */}
      <section className="py-20 px-6" style={{ background: 'var(--canvas)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-[28px] font-bold tracking-tight mb-3"
              style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)', letterSpacing: 'var(--ls-display)' }}>
              Our commitments to you
            </h2>
            <p className="text-[15px]" style={{ color: 'var(--ink-secondary)' }}>
              Four pillars that underpin everything we build.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {PILLARS.map((pillar) => (
              <div key={pillar.title} className="rounded-xl p-7" style={{ background: cardBg, border: cardBorder }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: 'rgba(232,93,0,0.12)', color: 'var(--lava)' }}>
                  {pillar.icon}
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--ink-display)' }}>{pillar.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Legal Documents */}
      <section className="py-20 px-6" style={{ background: 'var(--canvas-app)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-[28px] font-bold tracking-tight mb-3"
              style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)', letterSpacing: 'var(--ls-display)' }}>
              Legal documents
            </h2>
            <p className="text-[15px]" style={{ color: 'var(--ink-secondary)' }}>
              Transparent policies you can read, understand, and rely on.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {LEGAL_DOCS.map((doc) => (
              <Link key={doc.title} to={doc.path}
                className="flex items-start gap-4 rounded-xl p-6 transition-all hover:border-[#E85D00]/20 group"
                style={{ background: cardBg, border: cardBorder }}
                data-testid={`trust-link-${doc.title.toLowerCase().replace(/\s+/g, '-')}`}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(232,93,0,0.12)' }}>
                  <doc.icon className="w-5 h-5" style={{ color: 'var(--lava)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-semibold mb-1 group-hover:text-[#E85D00] transition-colors"
                    style={{ color: 'var(--ink-display)' }}>
                    {doc.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>{doc.summary}</p>
                </div>
                <ArrowRight className="w-4 h-4 mt-1 shrink-0 opacity-30 group-hover:opacity-100 group-hover:text-[#E85D00] transition-all"
                  style={{ color: 'var(--ink-secondary)' }} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Badges */}
      <section className="py-16 px-6" style={{ background: 'var(--canvas)', borderTop: '1px solid var(--border)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-[28px] font-bold tracking-tight mb-3"
              style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)', letterSpacing: 'var(--ls-display)' }}>
              Compliance & standards
            </h2>
            <p className="text-[15px]" style={{ color: 'var(--ink-secondary)' }}>
              The frameworks and protocols we adhere to.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {BADGES.map((badge) => (
              <div key={badge}
                className="flex items-center gap-2.5 px-5 py-3 rounded-lg"
                style={{ background: cardBg, border: cardBorder }}>
                <Shield className="w-4 h-4" style={{ color: 'var(--lava)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--ink-display)' }}>{badge}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Handling */}
      <section className="py-20 px-6" style={{ background: 'var(--canvas-app)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-[28px] font-bold tracking-tight mb-3"
              style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)', letterSpacing: 'var(--ls-display)' }}>
              How we handle your data
            </h2>
            <p className="text-[15px]" style={{ color: 'var(--ink-secondary)' }}>
              Clear answers to common questions about data practices.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {DATA_FAQ.map((item) => (
              <div key={item.q} className="rounded-xl p-7" style={{ background: cardBg, border: cardBorder }}>
                <h3 className="text-[15px] font-semibold mb-3" style={{ color: 'var(--ink-display)' }}>{item.q}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>{item.a}</p>
                {item.bullets && (
                  <ul className="mt-2 space-y-1.5">
                    {item.bullets.map((b) => (
                      <li key={b} className="text-sm leading-relaxed pl-4 relative"
                        style={{ color: 'var(--ink-secondary)' }}>
                        <span className="absolute left-0 top-[9px] w-1.5 h-1.5 rounded-full" style={{ background: 'var(--lava)' }} />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center"
        style={{ background: 'var(--canvas)', borderTop: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
            style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)', letterSpacing: 'var(--ls-display)' }}>
            Questions about security?
          </h2>
          <p className="text-base mb-8" style={{ color: 'var(--ink-secondary)' }}>
            Our team is here to discuss your specific compliance and security requirements.
          </p>
          <Link to="/contact"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all hover:text-white"
            style={{ color: '#E85D00', border: '1.5px solid #E85D00', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E85D00'; e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#E85D00'; }}>
            Contact Us
          </Link>
        </div>
      </section>
    </WebsiteLayout>
  );
}
