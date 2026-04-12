/**
 * AboutPage — "Built by Operators, for Operators" marketing page.
 *
 * Sections: Hero, Origin Story, Mission (3 cards), Values (4 cards), CTA.
 * Uses WebsiteLayout wrapper. No auth required.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { Shield, Zap, Users, Eye, ArrowRight, Lock, Heart } from 'lucide-react';

const ValueCard = ({ icon, title, description }) => (
  <div className="rounded-xl p-6 transition-all duration-300 hover:border-[var(--lava,#E85D00)]/30 hover:-translate-y-0.5"
    style={{
      background: 'var(--bg-card, rgba(140,165,200,0.04))',
      border: '1px solid var(--border-card, rgba(160,185,220,0.12))',
    }}>
    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
      style={{ background: 'rgba(232,93,0,0.1)', color: 'var(--lava, #E85D00)' }}>
      {icon}
    </div>
    <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--ink-display, #EDF1F7)' }}>{title}</h3>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>{description}</p>
  </div>
);

const MissionCard = ({ icon, title, description }) => (
  <div className="rounded-xl p-6"
    style={{
      background: 'var(--bg-card, rgba(140,165,200,0.04))',
      border: '1px solid var(--border-card, rgba(160,185,220,0.12))',
    }}>
    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
      style={{ background: 'rgba(37,99,235,0.1)', color: '#60A5FA' }}>
      {icon}
    </div>
    <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--ink-display, #EDF1F7)' }}>{title}</h3>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>{description}</p>
  </div>
);

export default function AboutPage() {
  return (
    <WebsiteLayout>
      {/* Hero */}
      <section className="relative py-24 md:py-32 text-center px-6" style={{ background: 'var(--bg-primary, #080C14)' }}>
        <div className="max-w-3xl mx-auto relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
            The Story Behind <span style={{ color: 'var(--lava, #E85D00)' }}>BIQc</span>
          </h1>
          <p className="text-lg md:text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
            Built by operators, for operators. One intelligence layer for every business decision.
          </p>
        </div>
        {/* Decorative orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-20 blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(232,93,0,0.3), transparent 70%)' }} />
      </section>

      {/* Origin Story */}
      <section className="py-20 px-6" style={{ background: 'var(--bg-secondary, #0B1120)' }}>
        <div className="max-w-3xl mx-auto">
          <span className="text-[10px] uppercase tracking-widest mb-3 block"
            style={{ color: 'var(--lava, #E85D00)', fontFamily: 'var(--font-mono, monospace)' }}>
            Our Origin
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-8" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
            Born from the Trenches
          </h2>
          <div className="space-y-5 text-base leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
            <p>
              BIQc was born from lived experience. After years of building and scaling businesses across Australia,
              we kept running into the same problem: the tools that were supposed to help us make better decisions
              were actually making things harder.
            </p>
            <p>
              Scattered data across a dozen platforms. Hours spent reconciling spreadsheets instead of
              talking to customers. Critical signals buried in email threads. We watched founders
              make decisions based on gut feel — not because they wanted to, but because getting real
              answers from their own data was too hard.
            </p>
            <p>
              So we built what we wished existed: a single intelligence layer that connects your existing
              tools, surfaces what matters, and helps you act on it — without needing a data team,
              a consultant, or another three-day workshop.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-6" style={{ background: 'var(--bg-primary, #080C14)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[10px] uppercase tracking-widest mb-3 block"
              style={{ color: 'var(--lava, #E85D00)', fontFamily: 'var(--font-mono, monospace)' }}>
              Why We Exist
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
              Our Mission
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
              Help Australian SMBs navigate the challenges of day-to-day operations and transition into
              the era of AI — with practical intelligence, not hype. One layer. Every decision.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <MissionCard
              icon={<Zap className="w-5 h-5" />}
              title="Practical Intelligence"
              description="Not dashboards you'll never check. Real insights that change what you do today — grounded in your actual data."
            />
            <MissionCard
              icon={<Users className="w-5 h-5" />}
              title="Built for SMBs"
              description="Enterprise intelligence without enterprise complexity. Designed for founders who wear every hat."
            />
            <MissionCard
              icon={<Shield className="w-5 h-5" />}
              title="AI That Serves You"
              description="Your data stays yours. No training on your information. AI that works for your business, not the other way around."
            />
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-6" style={{ background: 'var(--bg-secondary, #0B1120)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[10px] uppercase tracking-widest mb-3 block"
              style={{ color: 'var(--lava, #E85D00)', fontFamily: 'var(--font-mono, monospace)' }}>
              Our Principles
            </span>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
              What We Stand For
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <ValueCard
              icon={<Eye className="w-5 h-5" />}
              title="Transparency"
              description="Every recommendation comes with evidence. We show our working, cite our sources, and never hallucinate confidence."
            />
            <ValueCard
              icon={<Lock className="w-5 h-5" />}
              title="Data Sovereignty"
              description="Your data is never used for model training. End-to-end encryption. Fully revocable access. Your business intelligence belongs to you."
            />
            <ValueCard
              icon={<Heart className="w-5 h-5" />}
              title="Empowering Humans"
              description="AI amplifies your judgment — it doesn't replace it. The best decisions come from human insight powered by complete information."
            />
            <ValueCard
              icon={<Zap className="w-5 h-5" />}
              title="Relentless Simplicity"
              description="If it takes a training manual, we haven't built it right. Intelligence should be as easy as opening your inbox."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center" style={{ background: 'var(--bg-primary, #080C14)' }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
            Ready to See Your Business Clearly?
          </h2>
          <p className="text-lg mb-8" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
            Start free. No credit card required. Intelligence in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white transition-all hover:brightness-110"
              style={{ background: 'var(--lava, #E85D00)', boxShadow: '0 4px 16px rgba(232,93,0,0.3)' }}>
              Start Free Today <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold transition-all hover:bg-white/5"
              style={{ color: 'var(--ink-display, #EDF1F7)', border: '1px solid var(--border-card, rgba(160,185,220,0.12))' }}>
              Talk to us
            </Link>
          </div>
        </div>
      </section>
    </WebsiteLayout>
  );
}
