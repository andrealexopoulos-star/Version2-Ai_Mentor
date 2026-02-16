import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Shield, Lock, Zap, BarChart3, Brain,
  Eye, AlertTriangle, TrendingUp, Check, X, ChevronRight
} from 'lucide-react';

const NAVY = '#0A0F1E';
const NAVY_2 = '#0f1629';
const NAVY_3 = '#151e32';
const CYAN = '#00F0FF';
const CYAN_DIM = 'rgba(0, 240, 255, 0.1)';
const RED = '#FF3B30';
const GOLD = '#D4AF37';
const SERIF = "'Playfair Display', serif";
const MONO = "'JetBrains Mono', monospace";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } } };
const stagger = { visible: { transition: { staggerChildren: 0.15 } } };

// ═══ THREAT TICKER ═══
const TICKER_ITEMS = [
  { type: 'signal', text: 'SIGNAL DETECTED: Client payment velocity declining', loc: '14:02 AEST · SYDNEY' },
  { type: 'pattern', text: 'PATTERN IDENTIFIED: Q3 pipeline concentration risk', loc: '14:01 AEST · MELBOURNE' },
  { type: 'anomaly', text: 'ANOMALY FLAGGED: Resource utilisation above threshold', loc: '13:58 AEST · BRISBANE' },
  { type: 'intel', text: 'INTELLIGENCE UPDATE: Competitor pricing shift detected', loc: '13:55 AEST · PERTH' },
  { type: 'signal', text: 'COMMITMENT DRIFT: 3 deliverables overdue across 2 clients', loc: '13:52 AEST · SYDNEY' },
  { type: 'pattern', text: 'CASH FLOW ALERT: Receivables ageing beyond 45 days', loc: '13:49 AEST · ADELAIDE' },
];

const ThreatTicker = () => (
  <div className="relative overflow-hidden py-3" style={{ borderTop: '1px solid rgba(0,240,255,0.15)', borderBottom: '1px solid rgba(0,240,255,0.15)' }}>
    <div className="flex animate-ticker whitespace-nowrap">
      {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
        <span key={i} className="inline-flex items-center gap-3 mx-8 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.type === 'anomaly' ? RED : CYAN, boxShadow: `0 0 6px ${item.type === 'anomaly' ? RED : CYAN}` }} />
          <span style={{ fontFamily: MONO, fontSize: 13, color: item.type === 'anomaly' ? RED : CYAN, letterSpacing: '0.04em' }}>{item.text}</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(148,163,184,0.6)' }}>{item.loc}</span>
        </span>
      ))}
    </div>
    <style>{`@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } } .animate-ticker { animation: ticker 45s linear infinite; }`}</style>
  </div>
);

// ═══ COMPARISON TABLE ═══
const COMPARISON = [
  { metric: 'Speed to Insight', sigma: 'Weeks to months', biqc: 'Real-time continuous' },
  { metric: 'Data Sovereignty', sigma: 'Often offshore', biqc: '100% Australian' },
  { metric: 'Cost per Analysis', sigma: '$50K–$200K consulting', biqc: 'From $149/mo' },
  { metric: 'Predictive Capability', sigma: 'Reactive / historical', biqc: 'Proactive / predictive' },
  { metric: 'Implementation Time', sigma: '6–18 months', biqc: '2 minutes' },
  { metric: 'Expertise Required', sigma: 'Black Belt certified', biqc: 'Zero training needed' },
];

const ComparisonTable = () => (
  <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="w-full overflow-x-auto">
    <table className="w-full border-collapse" style={{ minWidth: 640 }}>
      <thead>
        <tr>
          <th className="text-left py-4 px-6" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.15em', color: 'rgba(148,163,184,0.5)' }}>METRIC</th>
          <th className="text-left py-4 px-6" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.15em', color: 'rgba(148,163,184,0.5)' }}>TRADITIONAL 6 SIGMA</th>
          <th className="text-left py-4 px-6" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.15em', color: CYAN }}>BIQc AI</th>
        </tr>
      </thead>
      <tbody>
        {COMPARISON.map((row, i) => (
          <motion.tr key={i} variants={fadeUp} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <td className="py-4 px-6 font-medium text-white text-sm">{row.metric}</td>
            <td className="py-4 px-6 text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
              <span className="flex items-center gap-2"><X className="w-3.5 h-3.5" style={{ color: 'rgba(255,59,48,0.6)' }} />{row.sigma}</span>
            </td>
            <td className="py-4 px-6 text-sm font-medium" style={{ color: CYAN }}>
              <span className="flex items-center gap-2"><Check className="w-3.5 h-3.5" />{row.biqc}</span>
            </td>
          </motion.tr>
        ))}
      </tbody>
    </table>
  </motion.div>
);

// ═══ PRICING ═══
const TIERS = [
  {
    name: 'Analyst', price: '149', period: '/mo', tag: 'For founders',
    features: ['Continuous email & calendar monitoring', 'Weekly intelligence briefing', 'Business DNA profile', 'Pattern detection (5 signals)', '1 user seat'],
    cta: 'Start Free Trial', highlight: false,
  },
  {
    name: 'Strategist', price: '399', period: '/mo', tag: 'Most popular',
    features: ['Everything in Analyst', 'Real-time threat & opportunity alerts', 'Advisory Soundboard (AI sparring)', 'CRM & accounting integration', 'OAC recommendations engine', 'Up to 5 user seats'],
    cta: 'Start Free Trial', highlight: true,
  },
  {
    name: 'Sovereign', price: '899', period: '/mo', tag: 'Full advisory',
    features: ['Everything in Strategist', 'Dedicated Strategy Squad advisor', 'Board-ready intelligence memos', 'Custom integration pipeline', 'Unlimited seats', 'Priority Australian support'],
    cta: 'Contact Sales', highlight: false,
  },
];

const PricingCard = ({ tier }) => {
  const navigate = useNavigate();
  return (
    <motion.div variants={fadeUp}
      className="relative rounded-sm p-[1px] h-full"
      style={{
        background: tier.highlight ? `linear-gradient(135deg, ${CYAN}, rgba(0,240,255,0.3), ${CYAN})` : 'rgba(255,255,255,0.06)',
        boxShadow: tier.highlight ? `0 0 40px -10px rgba(0,240,255,0.3)` : 'none',
      }}
    >
      <div className="rounded-sm p-8 h-full flex flex-col" style={{ background: tier.highlight ? NAVY_2 : NAVY_3 }}>
        {tier.highlight && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-[11px] font-semibold tracking-widest uppercase" style={{ fontFamily: MONO, background: CYAN, color: NAVY }}>
            Recommended
          </span>
        )}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] mb-2" style={{ fontFamily: MONO, color: tier.highlight ? CYAN : 'rgba(148,163,184,0.5)' }}>{tier.tag}</p>
          <h3 className="text-2xl font-semibold text-white mb-1" style={{ fontFamily: SERIF }}>{tier.name}</h3>
          <div className="flex items-baseline gap-1 mt-4">
            <span className="text-4xl font-bold text-white" style={{ fontFamily: SERIF }}>${tier.price}</span>
            <span className="text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>{tier.period}</span>
          </div>
        </div>
        <ul className="space-y-3 mb-8 flex-1">
          {tier.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: 'rgba(203,213,225,0.9)' }}>
              <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: tier.highlight ? CYAN : 'rgba(148,163,184,0.5)' }} />
              {f}
            </li>
          ))}
        </ul>
        <button
          onClick={() => navigate(tier.name === 'Sovereign' ? '/trust' : '/register-supabase')}
          className="w-full py-3.5 text-sm font-semibold tracking-wide transition-all"
          style={{
            background: tier.highlight ? CYAN : 'transparent',
            color: tier.highlight ? NAVY : 'white',
            border: tier.highlight ? 'none' : '1px solid rgba(255,255,255,0.15)',
          }}
          data-testid={`pricing-cta-${tier.name.toLowerCase()}`}
        >
          {tier.cta}
        </button>
      </div>
    </motion.div>
  );
};

// ═══ MAIN LANDING PAGE ═══
const LandingIntelligent = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: NAVY, color: 'white' }}>
      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm flex items-center justify-center" style={{ background: CYAN }}>
              <span className="font-bold text-lg" style={{ color: NAVY }}>B</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-white">BIQc</span>
            <span className="text-[10px] tracking-wider hidden sm:inline" style={{ color: 'rgba(148,163,184,0.5)' }}>SOVEREIGN INTELLIGENCE</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/trust')} className="text-sm font-medium px-4 py-2 transition-colors hidden sm:inline-flex" style={{ color: 'rgba(203,213,225,0.8)' }} data-testid="nav-trust-link">
              Trust
            </button>
            <button onClick={() => navigate('/login-supabase')} className="text-sm font-medium px-4 py-2 transition-colors" style={{ color: 'rgba(203,213,225,0.8)' }} data-testid="nav-login">
              Log In
            </button>
            <button onClick={() => navigate('/register-supabase')} className="text-sm font-semibold px-5 py-2.5 transition-all" style={{ background: 'white', color: NAVY }} data-testid="nav-start-free">
              Start Free
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-28 sm:pt-36 pb-0 px-6 md:px-12" data-testid="hero-section">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-3 space-y-8">
              <motion.div variants={fadeUp}>
                <p className="text-xs uppercase tracking-[0.2em] mb-5" style={{ fontFamily: MONO, color: CYAN }}>Australian Business Intelligence</p>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.08] tracking-tight" style={{ fontFamily: SERIF }}>
                  Command Your<br />Business<br /><span style={{ color: CYAN }}>Sovereignty</span>
                </h1>
              </motion.div>
              <motion.p variants={fadeUp} className="text-lg leading-relaxed max-w-xl" style={{ color: 'rgba(203,213,225,0.8)' }}>
                BIQc continuously monitors your business activity across email, calendar, CRM, and operations — surfacing threats and opportunities before they become crises.
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
                <button onClick={() => navigate('/register-supabase')} className="px-8 py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all" style={{ background: CYAN, color: NAVY }} data-testid="hero-cta-primary">
                  Deploy Intelligence <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => navigate('/trust')} className="px-8 py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all" style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'white' }} data-testid="hero-cta-trust">
                  <Shield className="w-4 h-4" /> Australian Sovereign
                </button>
              </motion.div>
              <motion.div variants={fadeUp} className="flex items-center gap-6 text-xs" style={{ color: 'rgba(148,163,184,0.5)', fontFamily: MONO }}>
                <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> AES-256 ENCRYPTED</span>
                <span className="flex items-center gap-1.5"><Shield className="w-3 h-3" /> AU DATA RESIDENCY</span>
              </motion.div>
            </div>
            <motion.div variants={fadeUp} className="lg:col-span-2 relative">
              <div className="rounded-sm p-6 relative overflow-hidden" style={{ background: NAVY_2, border: '1px solid rgba(0,240,255,0.12)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: RED }} /><div className="w-2.5 h-2.5 rounded-full" style={{ background: GOLD }} /><div className="w-2.5 h-2.5 rounded-full" style={{ background: '#10B981' }} />
                  <span className="ml-2 text-[11px]" style={{ fontFamily: MONO, color: 'rgba(148,163,184,0.4)' }}>BIQc Intelligence Feed</span>
                </div>
                <div className="space-y-3">
                  {TICKER_ITEMS.slice(0, 4).map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.3, duration: 0.5 }}
                      className="flex items-start gap-2.5 py-2 px-3 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: item.type === 'anomaly' ? RED : CYAN, boxShadow: `0 0 6px ${item.type === 'anomaly' ? RED : CYAN}` }} />
                      <div>
                        <p className="text-xs leading-relaxed" style={{ fontFamily: MONO, color: item.type === 'anomaly' ? RED : CYAN }}>{item.text}</p>
                        <p className="text-[10px] mt-0.5" style={{ fontFamily: MONO, color: 'rgba(148,163,184,0.3)' }}>{item.loc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-16" style={{ background: `linear-gradient(transparent, ${NAVY_2})` }} />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── THREAT TICKER ── */}
      <div className="mt-16 sm:mt-20" data-testid="threat-ticker">
        <ThreatTicker />
      </div>

      {/* ── PROBLEM STATEMENT ── */}
      <section className="py-24 sm:py-32 px-6 md:px-12" style={{ background: NAVY_2 }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-4xl mx-auto text-center space-y-8">
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight" style={{ fontFamily: SERIF }}>
            No single tool sees the<br />whole system
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: 'rgba(203,213,225,0.7)' }}>
            You're accountable for sales, operations, cash, capacity, and risk — but the signals that matter form across systems. Conversations stall. Commitments drift. Patterns emerge where no one is looking.
          </motion.p>
          <motion.p variants={fadeUp} className="text-xl font-semibold" style={{ color: CYAN }}>
            BIQc watches the system end-to-end. So you don't have to.
          </motion.p>
        </motion.div>
      </section>

      {/* ── INTELLIGENCE LAYER ── */}
      <section className="py-24 sm:py-32 px-6 md:px-12">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {[
            { icon: Eye, title: 'Monitors Continuously', desc: 'Watches email, calendar, CRM, and operations in real time. Builds context quietly while you work.' },
            { icon: Brain, title: 'Detects Patterns', desc: 'Identifies what\'s recurring, drifting, or being deferred. Connects signals across disciplines.' },
            { icon: AlertTriangle, title: 'Surfaces What Matters', desc: 'Doesn\'t report everything. Only escalates when a signal crosses the threshold of relevance.' },
          ].map((item, i) => (
            <motion.div key={i} variants={fadeUp} className="p-8 rounded-sm transition-all" style={{ background: NAVY_3, border: '1px solid rgba(255,255,255,0.06)' }}>
              <item.icon className="w-6 h-6 mb-5" style={{ color: CYAN }} strokeWidth={1.5} />
              <h3 className="text-lg font-semibold text-white mb-3" style={{ fontFamily: SERIF }}>{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(203,213,225,0.7)' }}>{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── 6 SIGMA vs BIQc ── */}
      <section className="py-24 sm:py-32 px-6 md:px-12" style={{ background: NAVY_2 }} data-testid="comparison-section">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] mb-4" style={{ fontFamily: MONO, color: CYAN }}>VALUE LOGIC</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold" style={{ fontFamily: SERIF }}>
              Traditional Consulting<br />vs. BIQc Intelligence
            </h2>
          </motion.div>
          <div className="rounded-sm overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <ComparisonTable />
          </div>
        </motion.div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-24 sm:py-32 px-6 md:px-12" data-testid="pricing-section">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-6xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] mb-4" style={{ fontFamily: MONO, color: CYAN }}>STRATEGY SQUAD PRICING</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-4" style={{ fontFamily: SERIF }}>
              Intelligence at every scale
            </h2>
            <p className="text-base max-w-lg mx-auto" style={{ color: 'rgba(203,213,225,0.6)' }}>All prices in AUD. 14-day free trial. Cancel anytime.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {TIERS.map((tier, i) => <PricingCard key={i} tier={tier} />)}
          </div>
        </motion.div>
      </section>

      {/* ── TRUST TEASER ── */}
      <section className="py-20 px-6 md:px-12" style={{ background: NAVY_2, borderTop: '1px solid rgba(0,240,255,0.08)', borderBottom: '1px solid rgba(0,240,255,0.08)' }}>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-sm flex items-center justify-center" style={{ background: CYAN_DIM, border: '1px solid rgba(0,240,255,0.2)' }}>
              <Lock className="w-6 h-6" style={{ color: CYAN }} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white" style={{ fontFamily: SERIF }}>Australian Data Sovereignty</h3>
              <p className="text-sm mt-1" style={{ color: 'rgba(148,163,184,0.6)' }}>AES-256 encryption. Your data never leaves Australian jurisdiction.</p>
            </div>
          </div>
          <button onClick={() => navigate('/trust')} className="px-6 py-3 text-sm font-semibold flex items-center gap-2 transition-all flex-shrink-0"
            style={{ border: `1px solid ${CYAN}`, color: CYAN }} data-testid="trust-teaser-cta">
            Enter The Vault <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 sm:py-32 px-6 md:px-12">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-3xl mx-auto text-center space-y-8">
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-semibold" style={{ fontFamily: SERIF }}>
            Stop reacting.<br />Start commanding.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg" style={{ color: 'rgba(203,213,225,0.7)' }}>
            Connect your systems. Let BIQc build context. Act with confidence.
          </motion.p>
          <motion.div variants={fadeUp}>
            <button onClick={() => navigate('/register-supabase')} className="px-10 py-4 text-sm font-semibold tracking-wide inline-flex items-center gap-2 transition-all"
              style={{ background: CYAN, color: NAVY }} data-testid="final-cta">
              Deploy Intelligence <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
          <motion.p variants={fadeUp} className="text-xs" style={{ fontFamily: MONO, color: 'rgba(148,163,184,0.4)' }}>
            Free to start. No credit card. Australian owned and operated.
          </motion.p>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 px-6 md:px-12" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>&copy; 2026 BIQc — Business IQ Centre. Powered by The Strategy Squad.</p>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/trust')} className="text-xs transition-colors" style={{ color: 'rgba(148,163,184,0.4)' }}>Trust & Security</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingIntelligent;
