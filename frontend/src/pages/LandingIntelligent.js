import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Shield, Lock, Eye, Brain, AlertTriangle,
  Check, X, ChevronRight, Zap, TrendingUp, Activity,
  Clock, DollarSign, Users, BarChart3
} from 'lucide-react';

const AZURE = '#007AFF';
const MINT = '#00D995';
const SLATE = '#1E293B';
const MUTED = '#64748B';
const HEAD = "'Inter Tight', sans-serif";
const MONO = "'Geist Mono', monospace";

const up = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } };
const stg = { visible: { transition: { staggerChildren: 0.08 } } };

const glass = {
  background: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.3)',
  boxShadow: '0 24px 48px -12px rgba(0,0,0,0.05)',
};

/* ═══ LIVE INTELLIGENCE FEED ═══ */
const FEED = [
  { icon: Shield, label: 'ATO Compliance Check', status: 'OK', color: MINT },
  { icon: TrendingUp, label: 'Sales Velocity Deviation', status: 'Corrected', color: AZURE },
  { icon: AlertTriangle, label: 'Cash Flow Forecast', status: 'Attention', color: '#F59E0B' },
  { icon: Activity, label: 'Client Retention Score', status: '94%', color: MINT },
  { icon: Eye, label: 'Pipeline Concentration Risk', status: 'Monitoring', color: AZURE },
  { icon: Lock, label: 'Data Sovereignty Audit', status: 'Passed', color: MINT },
  { icon: DollarSign, label: 'CAC Leak Detection', status: 'Clean', color: MINT },
  { icon: Zap, label: 'SOP Compliance Rate', status: '97%', color: MINT },
];

const LiveFeed = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => { const t = setInterval(() => setIdx(p => (p + 1) % FEED.length), 2800); return () => clearInterval(t); }, []);
  return (
    <div className="space-y-2">
      {FEED.slice(idx, idx + 4).concat(FEED.slice(0, Math.max(0, idx + 4 - FEED.length))).map((f, i) => (
        <motion.div key={`${idx}-${i}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
          className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/60" style={{ border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div className="flex items-center gap-3">
            <f.icon className="w-4 h-4" style={{ color: AZURE }} strokeWidth={1.5} />
            <span className="text-[13px] font-medium" style={{ color: SLATE, fontFamily: HEAD }}>{f.label}</span>
          </div>
          <span className="text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full" style={{ fontFamily: MONO, color: f.color, background: `${f.color}10` }}>
            {f.status}
          </span>
        </motion.div>
      ))}
    </div>
  );
};

/* ═══ COMPARISON TABLE ═══ */
const ROWS = [
  ['Speed to Insight', 'Weeks to months', 'Seconds — real-time'],
  ['Data Sovereignty', 'Often offshore', '100% Australian'],
  ['Cost per Analysis', '$50K–$200K consulting', 'From $149/mo'],
  ['Predictive Capability', 'Reactive', 'Agentic AI — proactive'],
  ['Implementation', '6–18 months', '2 minutes'],
  ['Advisor Coupling', 'None', 'Built-in executive mentoring'],
];

/* ═══ OUTCOME MATRIX (WIIFM) ═══ */
const OUTCOMES = [
  {
    icon: Clock, accent: AZURE,
    metric: '15+', unit: 'hours/week reclaimed',
    title: 'Reclaim Your Time',
    desc: 'Stop being the "Chief Monitor." BIQc watches sales calls, staff output, and operational drift while you focus on the $10K tasks that actually move the needle.',
    mentor: "Andre's frameworks prioritise your attention so you never waste a minute on noise.",
  },
  {
    icon: DollarSign, accent: MINT,
    metric: '8–12%', unit: 'profit bleed plugged',
    title: 'Plug Cashflow Leaks',
    desc: 'Real-time detection of high CAC, zombie subscriptions, and ATO liability mismatches — before they hit your bank balance. Live margin monitoring, always on.',
    mentor: 'Automated financial "Red Lines" based on 3 years of proven SME advisory.',
  },
  {
    icon: Users, accent: AZURE,
    metric: '97%', unit: 'SOP compliance',
    title: 'Enforce Operational Strength',
    desc: 'AI detects when staff skip steps or leads go cold, triggering intervention before the client leaves a bad review. SOPs that actually work — enforced 24/7.',
    mentor: 'The tool enforces the Strategy Squad standard across your entire team.',
  },
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
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/90 select-none" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, #D4AF37, ${AZURE})` }}>
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
      {/* Mint Spring radial gradient — top right */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse at 85% -5%, #F0FFF4 0%, transparent 55%)' }} />

      {/* ─── NAV ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80" style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-16 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: AZURE }}>
              <span className="font-black text-sm text-white" style={{ fontFamily: HEAD }}>B</span>
            </div>
            <span className="font-bold text-base tracking-tight" style={{ fontFamily: HEAD }}>BIQc</span>
            <span className="text-[9px] tracking-[0.18em] uppercase hidden sm:inline" style={{ fontFamily: MONO, color: MUTED }}>Sovereign Intelligence</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => nav('/trust')} className="text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-slate-50 hidden sm:inline-flex" style={{ color: MUTED, fontFamily: HEAD }} data-testid="nav-trust-link">Trust</button>
            <button onClick={() => nav('/login-supabase')} className="text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-slate-50" style={{ color: MUTED, fontFamily: HEAD }} data-testid="nav-login">Log In</button>
            <button onClick={() => nav('/register-supabase')} className="text-[13px] font-semibold px-5 py-2.5 rounded-lg text-white" style={{ background: AZURE, fontFamily: HEAD, boxShadow: '0 4px 14px rgba(0,122,255,0.25)' }} data-testid="nav-start-free">Start Free</button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative z-10 pt-32 sm:pt-40 pb-16 px-6 lg:px-16" data-testid="hero-section">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={stg} className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-8">
              <motion.div variants={up} className="space-y-5">
                <p className="text-[11px] uppercase tracking-[0.25em] font-semibold" style={{ fontFamily: MONO, color: AZURE }}>Sovereign Business Intelligence</p>
                <h1 className="text-[2.6rem] sm:text-[3.2rem] lg:text-[3.8rem] font-semibold leading-[1.08] tracking-[-0.02em]" style={{ fontFamily: HEAD }}>
                  Business Clarity,<br />Mastered.
                </h1>
                <p className="text-xl font-medium" style={{ fontFamily: HEAD, color: SLATE }}>Your Sovereign AI Mentor.</p>
              </motion.div>
              <motion.p variants={up} className="text-base leading-[1.75] max-w-lg" style={{ color: MUTED }}>
                Coupling real-time Intelligence Insights with 3 years of Executive Mentoring. BIQc is the only Business Support platform that protects your operations, optimises cashflow, and reclaims your time — with 100% Australian Data Sovereignty.
              </motion.p>
              <motion.div variants={up} className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => nav('/register-supabase')} className="px-8 py-4 text-[13px] font-semibold rounded-xl flex items-center justify-center gap-2.5 text-white transition-all hover:brightness-105"
                  style={{ background: AZURE, fontFamily: HEAD, boxShadow: '0 8px 24px rgba(0,122,255,0.25)' }} data-testid="hero-cta-primary">
                  Deploy My Intelligence <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => nav('/trust')} className="px-8 py-4 text-[13px] font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-all hover:bg-white/90"
                  style={{ ...glass, color: SLATE, fontFamily: HEAD }} data-testid="hero-cta-mentor">
                  <Brain className="w-4 h-4" style={{ color: AZURE }} /> Meet Your Mentor
                </button>
              </motion.div>
              <motion.div variants={up} className="flex items-center gap-5">
                <span className="flex items-center gap-1.5 text-[10px] tracking-[0.1em] uppercase font-medium" style={{ fontFamily: MONO, color: MUTED }}><Lock className="w-3 h-3" style={{ color: AZURE }} /> AES-256</span>
                <span className="flex items-center gap-1.5 text-[10px] tracking-[0.1em] uppercase font-medium" style={{ fontFamily: MONO, color: MUTED }}><Shield className="w-3 h-3" style={{ color: MINT }} /> AU Sovereign</span>
              </motion.div>
            </div>
            <motion.div variants={up}>
              <div className="rounded-2xl p-6" style={{ ...glass }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: MINT }} />
                    <span className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ fontFamily: MONO, color: MUTED }}>Live Sentinel Feed</span>
                  </div>
                  <span className="text-[10px]" style={{ fontFamily: MONO, color: '#94A3B8' }}>AEST</span>
                </div>
                <LiveFeed />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── OUTCOME MATRIX (WIIFM) ─── */}
      <section className="relative z-10 py-24 sm:py-32 px-6 lg:px-16" style={{ background: '#FAFCFE' }} data-testid="outcome-matrix">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-7xl mx-auto">
          <motion.div variants={up} className="text-center mb-16">
            <p className="text-[11px] uppercase tracking-[0.25em] font-semibold mb-4" style={{ fontFamily: MONO, color: AZURE }}>AI SME Mentoring Australia</p>
            <h2 className="text-[2rem] sm:text-[2.6rem] font-semibold tracking-[-0.02em]" style={{ fontFamily: HEAD }}>
              What's in it for you?
            </h2>
            <p className="text-base mt-3 max-w-lg mx-auto" style={{ color: MUTED }}>Not features. Outcomes. The measurable difference BIQc makes to your business, every week.</p>
          </motion.div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {OUTCOMES.map((o, i) => (
              <motion.div key={i} variants={up} className="rounded-2xl p-8 flex flex-col transition-all hover:translate-y-[-2px]" style={{ ...glass }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${o.accent}10` }}>
                    <o.icon className="w-5 h-5" style={{ color: o.accent }} strokeWidth={1.5} />
                  </div>
                  <div>
                    <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: HEAD, color: o.accent }}>{o.metric}</span>
                    <span className="text-[11px] ml-1.5" style={{ fontFamily: MONO, color: MUTED }}>{o.unit}</span>
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-3 tracking-tight" style={{ fontFamily: HEAD }}>{o.title}</h3>
                <p className="text-[13px] leading-relaxed mb-5 flex-1" style={{ color: MUTED }}>{o.desc}</p>
                <div className="pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <p className="text-[12px] leading-relaxed italic" style={{ color: '#94A3B8' }}>
                    <span className="font-semibold not-italic" style={{ color: AZURE }}>Mentor Edge:</span> {o.mentor}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── DATA SANCTUARY ─── */}
      <section className="relative z-10 py-20 px-6 lg:px-16" data-testid="data-sanctuary">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-4xl mx-auto">
          <motion.div variants={up} className="rounded-2xl p-10 sm:p-12" style={{ ...glass }}>
            <div className="flex items-start gap-6">
              <div className="w-1 self-stretch flex-shrink-0 rounded-full" style={{ background: `linear-gradient(${AZURE}, ${MINT})` }} />
              <div className="space-y-5">
                <p className="text-[11px] uppercase tracking-[0.25em] font-semibold" style={{ fontFamily: MONO, color: AZURE }}>Real-time Operational Sentinel</p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em]" style={{ fontFamily: HEAD }}>Your Business DNA is yours.</h2>
                <p className="text-sm leading-[1.8]" style={{ color: MUTED }}>
                  Physically hosted on encrypted Sydney and Melbourne nodes. Zero leakage to global LLM training. We are a Sovereign Intelligence Partner, not a data broker.
                </p>
                <p className="text-sm leading-[1.8]" style={{ color: MUTED }}>
                  BIQc uses private, containerised AI instances. Your strategic insights are never used to improve the general models used by your competitors.
                </p>
                <button onClick={() => nav('/trust')} className="inline-flex items-center gap-2 text-[13px] font-semibold mt-2" style={{ color: AZURE, fontFamily: HEAD }}>
                  Enter The Vault <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── BEYOND 6 SIGMA ─── */}
      <section className="relative z-10 py-24 sm:py-32 px-6 lg:px-16" style={{ background: '#FAFCFE' }} data-testid="comparison-section">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-5xl mx-auto">
          <motion.div variants={up} className="text-center mb-14">
            <p className="text-[11px] uppercase tracking-[0.25em] font-semibold mb-4" style={{ fontFamily: MONO, color: AZURE }}>Sovereign Business Intelligence</p>
            <h2 className="text-[2rem] sm:text-[2.6rem] font-semibold tracking-[-0.02em]" style={{ fontFamily: HEAD }}>Beyond 6 Sigma</h2>
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
                    <td className="py-4 px-6 text-[13px]" style={{ color: '#94A3B8' }}><span className="inline-flex items-center gap-2"><X className="w-3.5 h-3.5" style={{ color: '#E2E8F0' }} />{s}</span></td>
                    <td className="py-4 px-6 text-[13px] font-semibold" style={{ color: AZURE, fontFamily: MONO }}><span className="inline-flex items-center gap-2"><Check className="w-3.5 h-3.5" style={{ color: MINT }} />{b}</span></td>
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
            <h2 className="text-[2rem] sm:text-[2.6rem] font-semibold tracking-[-0.02em] mb-3" style={{ fontFamily: HEAD }}>Intelligence at every scale</h2>
            <p className="text-sm" style={{ color: MUTED }}>All prices in AUD. Cancel anytime. 14-day free trial on The Pulse.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TIERS.map((t, i) => (
              <motion.div key={i} variants={up} className="relative rounded-2xl p-[1px] h-full"
                style={{ background: t.hl ? `linear-gradient(160deg, ${AZURE}, ${MINT})` : 'transparent' }}>
                <div className="rounded-2xl p-8 h-full flex flex-col bg-white" style={{ boxShadow: t.hl ? '0 24px 48px -12px rgba(0,122,255,0.1)' : '0 24px 48px -12px rgba(0,0,0,0.05)', border: t.hl ? 'none' : '1px solid rgba(0,0,0,0.06)' }}>
                  {t.hl && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[9px] font-bold tracking-[0.18em] uppercase text-white" style={{ fontFamily: MONO, background: AZURE }}>Recommended</span>}
                  <p className="text-[9px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ fontFamily: MONO, color: t.hl ? AZURE : MUTED }}>{t.tag}</p>
                  <h3 className="text-xl font-semibold tracking-tight" style={{ fontFamily: HEAD }}>{t.name}</h3>
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
                    style={{ background: t.hl ? AZURE : 'transparent', color: t.hl ? 'white' : SLATE, border: t.hl ? 'none' : '1px solid rgba(0,0,0,0.1)', fontFamily: HEAD, boxShadow: t.hl ? '0 4px 14px rgba(0,122,255,0.2)' : 'none' }}
                    data-testid={`pricing-cta-${t.name.replace(/\s+/g, '-').toLowerCase()}`}>{t.cta}</button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="relative z-10 py-28 sm:py-36 px-6 lg:px-16">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-3xl mx-auto text-center space-y-8">
          <motion.h2 variants={up} className="text-[2.2rem] sm:text-[3rem] font-semibold leading-[1.08] tracking-[-0.02em]" style={{ fontFamily: HEAD }}>
            Business clarity,<br /><span style={{ color: AZURE }}>mastered.</span>
          </motion.h2>
          <motion.p variants={up} className="text-base" style={{ color: MUTED }}>
            Connect your systems. Let BIQc build context. Act with confidence.
          </motion.p>
          <motion.div variants={up}>
            <button onClick={() => nav('/register-supabase')} className="px-10 py-4 rounded-xl text-[13px] font-semibold inline-flex items-center gap-2.5 text-white transition-all hover:brightness-105"
              style={{ background: AZURE, fontFamily: HEAD, boxShadow: '0 8px 24px rgba(0,122,255,0.25)' }} data-testid="final-cta">
              Deploy My Intelligence <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
          <motion.p variants={up} className="text-[10px] tracking-[0.1em] uppercase font-medium" style={{ fontFamily: MONO, color: '#94A3B8' }}>
            Free to start · No credit card · Australian owned and operated
          </motion.p>
        </motion.div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative z-10 py-8 px-6 lg:px-16" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px]" style={{ color: '#94A3B8', fontFamily: MONO }}>&copy; 2026 BIQc — Business IQ Centre. Powered by The Strategy Squad.</p>
          <button onClick={() => nav('/trust')} className="text-[11px] hover:text-slate-600 transition-colors" style={{ color: '#94A3B8', fontFamily: MONO }}>Trust & Security</button>
        </div>
      </footer>
    </div>
  );
};

export default LandingIntelligent;
