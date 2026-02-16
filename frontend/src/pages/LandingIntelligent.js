import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Shield, Lock, Eye, Brain, AlertTriangle,
  Check, X, ChevronRight, Zap, TrendingUp, Activity
} from 'lucide-react';

const AZURE = '#007AFF';
const MINT = '#00F5D4';
const SLATE = '#1E293B';
const MUTED = '#64748B';
const GLASS = 'rgba(255,255,255,0.65)';
const GLASS_BORDER = 'rgba(255,255,255,0.85)';
const SHADOW = '0 20px 40px rgba(0,0,0,0.04)';
const HEAD = "'Inter Tight', sans-serif";
const MONO = "'Geist Mono', monospace";

const up = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } };
const stg = { visible: { transition: { staggerChildren: 0.1 } } };

const glass = {
  background: GLASS,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: `1px solid ${GLASS_BORDER}`,
  boxShadow: SHADOW,
};

/* ═══ LIVE INTELLIGENCE FEED ═══ */
const FEED = [
  { icon: Shield, label: 'ATO Compliance Check', status: 'OK', color: '#22C55E' },
  { icon: TrendingUp, label: 'Sales Velocity Deviation', status: 'Corrected', color: AZURE },
  { icon: AlertTriangle, label: 'Cash Flow Forecast', status: 'Attention', color: '#F59E0B' },
  { icon: Activity, label: 'Client Retention Score', status: '94%', color: '#22C55E' },
  { icon: Eye, label: 'Pipeline Concentration Risk', status: 'Monitoring', color: AZURE },
  { icon: Lock, label: 'Data Sovereignty Audit', status: 'Passed', color: '#22C55E' },
  { icon: Brain, label: 'Competitor Pricing Shift', status: 'Detected', color: '#F59E0B' },
  { icon: Zap, label: 'Revenue Velocity Index', status: '+12%', color: '#22C55E' },
];

const LiveFeed = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => { const t = setInterval(() => setIdx(p => (p + 1) % FEED.length), 2800); return () => clearInterval(t); }, []);
  return (
    <div className="space-y-2">
      {FEED.slice(idx, idx + 4).concat(FEED.slice(0, Math.max(0, idx + 4 - FEED.length))).map((f, i) => (
        <motion.div key={`${idx}-${i}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
          className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ ...glass, background: 'rgba(255,255,255,0.5)' }}>
          <div className="flex items-center gap-3">
            <f.icon className="w-4 h-4" style={{ color: AZURE }} strokeWidth={1.5} />
            <span className="text-[13px] font-medium" style={{ color: SLATE, fontFamily: HEAD }}>{f.label}</span>
          </div>
          <span className="text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full" style={{ fontFamily: MONO, color: f.color, background: `${f.color}12` }}>
            {f.status}
          </span>
        </motion.div>
      ))}
    </div>
  );
};

/* ═══ COMPARISON ═══ */
const ROWS = [
  ['Speed to Insight', 'Weeks to months', 'Seconds — real-time'],
  ['Data Sovereignty', 'Often offshore', '100% Australian'],
  ['Cost per Analysis', '$50K–$200K consulting', 'From $149/mo'],
  ['Predictive Capability', 'Reactive', 'Agentic AI — proactive'],
  ['Implementation', '6–18 months', '2 minutes'],
  ['Advisor Coupling', 'None', 'Built-in mentoring'],
];

/* ═══ PRICING ═══ */
const TIERS = [
  { name: 'The Pulse', price: '149', tag: 'Sentinel monitoring', feat: ['24/7 Sentinel Monitoring', 'Risk & anomaly alerts', 'Business DNA profile', 'Weekly intelligence briefing', 'Email & calendar integration', '1 user seat'], cta: 'Deploy My Intelligence', hl: false },
  { name: 'The Strategist', price: '1,950', tag: 'Advisory calibration', feat: ['Everything in The Pulse', 'Full BIQc Intelligence Matrix', 'Monthly Advisory Calibration with Andre', 'CRM & accounting integration', 'OAC recommendations engine', 'Board-ready intelligence memos', 'Up to 5 user seats'], cta: 'Deploy My Intelligence', hl: true },
  { name: 'The Sovereign', price: '5,500', tag: 'Full sentinel integration', feat: ['Everything in The Strategist', 'Weekly Force Memo Execution', 'Daily mentoring sessions', 'Custom integration pipeline', 'Dedicated Strategy Squad advisor', 'Unlimited seats', 'Priority sovereign support'], cta: 'Contact Sales', hl: false },
];

/* ═══ SOVEREIGN BADGE ═══ */
const SovereignBadge = () => (
  <div className="fixed bottom-6 right-6 z-40" data-testid="sovereign-badge">
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full cursor-default select-none"
      style={{ ...glass, background: 'rgba(255,255,255,0.88)', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #D4AF37, #007AFF)' }}>
        <Shield className="w-3 h-3 text-white" strokeWidth={2} />
      </div>
      <span className="text-[11px] font-semibold tracking-wide" style={{ fontFamily: MONO, color: SLATE }}>Australian Sovereign Data</span>
    </div>
  </div>
);

/* ═══ PAGE ═══ */
const LandingIntelligent = () => {
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-white relative" style={{ color: SLATE }}>
      <SovereignBadge />

      {/* Subtle background texture */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse at 20% 0%, rgba(0,122,255,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(0,245,212,0.04) 0%, transparent 60%)' }} />

      {/* ─── NAV ─── */}
      <nav className="fixed top-0 inset-x-0 z-50" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-16 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: AZURE }}>
              <span className="font-black text-sm text-white" style={{ fontFamily: HEAD }}>B</span>
            </div>
            <span className="font-bold text-base tracking-tight" style={{ fontFamily: HEAD, color: SLATE }}>BIQc</span>
            <span className="text-[9px] tracking-[0.18em] uppercase hidden sm:inline" style={{ fontFamily: MONO, color: MUTED }}>Sovereign Intelligence</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => nav('/trust')} className="text-[13px] font-medium px-4 py-2 hidden sm:inline-flex rounded-lg transition-colors hover:bg-slate-50" style={{ color: MUTED, fontFamily: HEAD }} data-testid="nav-trust-link">Trust</button>
            <button onClick={() => nav('/login-supabase')} className="text-[13px] font-medium px-4 py-2 rounded-lg transition-colors hover:bg-slate-50" style={{ color: MUTED, fontFamily: HEAD }} data-testid="nav-login">Log In</button>
            <button onClick={() => nav('/register-supabase')} className="text-[13px] font-semibold px-5 py-2.5 rounded-lg transition-all hover:brightness-110" style={{ background: AZURE, color: 'white', fontFamily: HEAD, boxShadow: '0 4px 14px rgba(0,122,255,0.3)' }} data-testid="nav-start-free">Start Free</button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative z-10 pt-32 sm:pt-40 pb-20 px-6 lg:px-16" data-testid="hero-section">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={stg} className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-8">
              <motion.div variants={up} className="space-y-6">
                <p className="text-[11px] uppercase tracking-[0.25em] font-semibold" style={{ fontFamily: MONO, color: AZURE }}>Australian Business Intelligence</p>
                <h1 className="text-[2.8rem] sm:text-[3.5rem] lg:text-[4.2rem] font-semibold leading-[1.05] tracking-[-0.02em]" style={{ fontFamily: HEAD, color: SLATE }}>
                  Business Clarity,<br />Mastered.
                </h1>
                <p className="text-lg leading-[1.7] max-w-lg" style={{ color: MUTED }}>
                  BIQc couples world-class Business Mentoring with Agentic AI to monitor, protect, and scale your enterprise in real-time. <span className="font-medium" style={{ color: SLATE }}>100% Australian-owned. 100% Sovereign Data.</span>
                </p>
              </motion.div>
              <motion.div variants={up} className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => nav('/register-supabase')} className="px-8 py-4 text-[13px] font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-all hover:brightness-110"
                  style={{ background: AZURE, color: 'white', fontFamily: HEAD, boxShadow: '0 8px 24px rgba(0,122,255,0.3)' }} data-testid="hero-cta-primary">
                  Deploy My Intelligence <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => nav('/trust')} className="px-8 py-4 text-[13px] font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-all hover:bg-white/80"
                  style={{ ...glass, color: SLATE, fontFamily: HEAD }} data-testid="hero-cta-trust">
                  <Shield className="w-4 h-4" style={{ color: AZURE }} /> Meet Your Mentor
                </button>
              </motion.div>
              <motion.div variants={up} className="flex items-center gap-5">
                <span className="flex items-center gap-1.5 text-[10px] tracking-[0.1em] uppercase font-medium" style={{ fontFamily: MONO, color: MUTED }}><Lock className="w-3 h-3" style={{ color: AZURE }} /> AES-256</span>
                <span className="flex items-center gap-1.5 text-[10px] tracking-[0.1em] uppercase font-medium" style={{ fontFamily: MONO, color: MUTED }}><Shield className="w-3 h-3" style={{ color: MINT }} /> AU Residency</span>
              </motion.div>
            </div>

            {/* Live Intelligence Feed */}
            <motion.div variants={up}>
              <div className="rounded-2xl p-6 relative" style={{ ...glass }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                    <span className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ fontFamily: MONO, color: MUTED }}>Live Intelligence Feed</span>
                  </div>
                  <span className="text-[10px]" style={{ fontFamily: MONO, color: '#94A3B8' }}>AEST</span>
                </div>
                <LiveFeed />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── SUBTITLE STATEMENT ─── */}
      <section className="relative z-10 py-24 sm:py-32 px-6 lg:px-16" style={{ background: '#F8FAFC' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-3xl mx-auto text-center space-y-6">
          <motion.p variants={up} className="text-[11px] uppercase tracking-[0.25em] font-semibold" style={{ fontFamily: MONO, color: AZURE }}>Your Sovereign Intelligence Sentinel</motion.p>
          <motion.h2 variants={up} className="text-[2rem] sm:text-[2.8rem] font-semibold leading-[1.1] tracking-[-0.02em]" style={{ fontFamily: HEAD }}>
            No single tool sees the whole system. BIQc does.
          </motion.h2>
          <motion.p variants={up} className="text-base leading-relaxed" style={{ color: MUTED }}>
            You're accountable for sales, operations, cash, capacity, and risk — but the signals that matter form across systems. BIQc watches end-to-end, so you lead with clarity.
          </motion.p>
        </motion.div>
      </section>

      {/* ─── INTELLIGENCE LAYER ─── */}
      <section className="relative z-10 py-24 sm:py-32 px-6 lg:px-16">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Eye, title: 'Monitors Continuously', desc: 'Watches email, calendar, CRM, and operations. Builds context quietly while you work.', accent: AZURE },
            { icon: Brain, title: 'Detects Patterns', desc: 'Identifies what\'s recurring, drifting, or being deferred. Connects signals across disciplines.', accent: MINT },
            { icon: AlertTriangle, title: 'Surfaces What Matters', desc: 'Only escalates when a signal crosses the threshold of relevance. No noise, no dashboards.', accent: AZURE },
          ].map((c, i) => (
            <motion.div key={i} variants={up} className="p-8 rounded-2xl transition-all hover:translate-y-[-2px]" style={{ ...glass }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: `${c.accent}12` }}>
                <c.icon className="w-5 h-5" style={{ color: c.accent }} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-semibold mb-2 tracking-tight" style={{ fontFamily: HEAD }}>{c.title}</h3>
              <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>{c.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ─── BEYOND 6 SIGMA ─── */}
      <section className="relative z-10 py-24 sm:py-32 px-6 lg:px-16" style={{ background: '#F8FAFC' }} data-testid="comparison-section">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-5xl mx-auto">
          <motion.div variants={up} className="text-center mb-14">
            <p className="text-[11px] uppercase tracking-[0.25em] font-semibold mb-4" style={{ fontFamily: MONO, color: AZURE }}>Beyond 6 Sigma</p>
            <h2 className="text-[2rem] sm:text-[2.8rem] font-semibold tracking-[-0.02em]" style={{ fontFamily: HEAD }}>Legacy Consulting vs. BIQc Intelligence</h2>
          </motion.div>
          <div className="rounded-2xl overflow-x-auto" style={{ ...glass }}>
            <table className="w-full border-collapse" style={{ minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <th className="text-left py-4 px-6 text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ fontFamily: MONO, color: MUTED }}>Metric</th>
                  <th className="text-left py-4 px-6 text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ fontFamily: MONO, color: MUTED }}>Legacy 6 Sigma</th>
                  <th className="text-left py-4 px-6 text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ fontFamily: MONO, color: AZURE }}>BIQc AI</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([m, s, b], i) => (
                  <motion.tr key={i} variants={up} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <td className="py-4 px-6 text-sm font-medium" style={{ fontFamily: HEAD }}>{m}</td>
                    <td className="py-4 px-6 text-[13px]" style={{ color: '#94A3B8' }}>
                      <span className="inline-flex items-center gap-2"><X className="w-3.5 h-3.5" style={{ color: '#E2E8F0' }} />{s}</span>
                    </td>
                    <td className="py-4 px-6 text-[13px] font-semibold" style={{ color: AZURE, fontFamily: MONO }}>
                      <span className="inline-flex items-center gap-2"><Check className="w-3.5 h-3.5" style={{ color: MINT }} />{b}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>

      {/* ─── PRICING ─── */}
      <section className="relative z-10 py-24 sm:py-32 px-6 lg:px-16" data-testid="pricing-section">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-6xl mx-auto">
          <motion.div variants={up} className="text-center mb-14">
            <p className="text-[11px] uppercase tracking-[0.25em] font-semibold mb-4" style={{ fontFamily: MONO, color: AZURE }}>Strategic Pricing Ladder</p>
            <h2 className="text-[2rem] sm:text-[2.8rem] font-semibold tracking-[-0.02em] mb-3" style={{ fontFamily: HEAD }}>Intelligence at every scale</h2>
            <p className="text-sm" style={{ color: MUTED }}>All prices in AUD. Cancel anytime. 14-day free trial on The Pulse.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TIERS.map((t, i) => (
              <motion.div key={i} variants={up} className="relative rounded-2xl p-[1px] h-full"
                style={{ background: t.hl ? `linear-gradient(160deg, ${AZURE}, ${MINT})` : 'transparent' }}>
                <div className="rounded-2xl p-8 h-full flex flex-col bg-white" style={{ boxShadow: t.hl ? '0 20px 60px rgba(0,122,255,0.12)' : SHADOW, border: t.hl ? 'none' : '1px solid rgba(0,0,0,0.06)' }}>
                  {t.hl && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[9px] font-bold tracking-[0.18em] uppercase text-white" style={{ fontFamily: MONO, background: AZURE }}>Recommended</span>}
                  <p className="text-[9px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ fontFamily: MONO, color: t.hl ? AZURE : MUTED }}>{t.tag}</p>
                  <h3 className="text-xl font-semibold mb-1 tracking-tight" style={{ fontFamily: HEAD }}>{t.name}</h3>
                  <div className="flex items-baseline gap-0.5 mt-3 mb-6">
                    <span className="text-4xl font-bold tracking-tight" style={{ fontFamily: HEAD }}>${t.price}</span>
                    <span className="text-xs" style={{ color: MUTED }}>/mo</span>
                  </div>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {t.feat.map((f, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-[13px]" style={{ color: MUTED }}>
                        <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: t.hl ? AZURE : '#CBD5E1' }} />{f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => nav(t.name === 'The Sovereign' ? '/trust' : '/register-supabase')}
                    className="w-full py-3.5 rounded-xl text-[13px] font-semibold tracking-wide transition-all"
                    style={{ background: t.hl ? AZURE : 'transparent', color: t.hl ? 'white' : SLATE, border: t.hl ? 'none' : '1px solid rgba(0,0,0,0.1)', fontFamily: HEAD, boxShadow: t.hl ? '0 4px 14px rgba(0,122,255,0.25)' : 'none' }}
                    data-testid={`pricing-cta-${t.name.replace(/\s+/g, '-').toLowerCase()}`}>{t.cta}</button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── TRUST TEASER ─── */}
      <section className="relative z-10 py-16 px-6 lg:px-16" style={{ background: '#F8FAFC' }}>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 p-8 rounded-2xl" style={{ ...glass }}>
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${AZURE}12` }}>
              <Lock className="w-5 h-5" style={{ color: AZURE }} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight" style={{ fontFamily: HEAD }}>Australian Data Sovereignty</h3>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>AES-256 encryption. Your data never leaves Australian jurisdiction.</p>
            </div>
          </div>
          <button onClick={() => nav('/trust')} className="px-5 py-2.5 rounded-xl text-[12px] font-semibold flex items-center gap-2 flex-shrink-0 transition-all hover:brightness-110"
            style={{ background: AZURE, color: 'white', fontFamily: HEAD, boxShadow: '0 4px 14px rgba(0,122,255,0.2)' }} data-testid="trust-teaser-cta">
            Enter The Vault <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="relative z-10 py-28 sm:py-36 px-6 lg:px-16">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-3xl mx-auto text-center space-y-8">
          <motion.h2 variants={up} className="text-[2.4rem] sm:text-[3.2rem] font-semibold leading-[1.05] tracking-[-0.02em]" style={{ fontFamily: HEAD }}>
            Business clarity,<br /><span style={{ color: AZURE }}>mastered.</span>
          </motion.h2>
          <motion.p variants={up} className="text-base" style={{ color: MUTED }}>
            Connect your systems. Let BIQc build context. Act with confidence.
          </motion.p>
          <motion.div variants={up}>
            <button onClick={() => nav('/register-supabase')} className="px-10 py-4 rounded-xl text-[13px] font-semibold inline-flex items-center gap-2.5 transition-all hover:brightness-110"
              style={{ background: AZURE, color: 'white', fontFamily: HEAD, boxShadow: '0 8px 24px rgba(0,122,255,0.3)' }} data-testid="final-cta">
              Deploy My Intelligence <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
          <motion.p variants={up} className="text-[10px] tracking-[0.1em] uppercase font-medium" style={{ fontFamily: MONO, color: '#94A3B8' }}>
            Free to start · No credit card · Australian owned and operated
          </motion.p>
        </motion.div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative z-10 py-8 px-6 lg:px-16" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px]" style={{ color: '#94A3B8', fontFamily: MONO }}>&copy; 2026 BIQc — Business IQ Centre. Powered by The Strategy Squad.</p>
          <button onClick={() => nav('/trust')} className="text-[11px] transition-colors hover:text-slate-600" style={{ color: '#94A3B8', fontFamily: MONO }}>Trust & Security</button>
        </div>
      </footer>
    </div>
  );
};

export default LandingIntelligent;
