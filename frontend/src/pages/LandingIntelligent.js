import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Shield, Lock, Eye, AlertTriangle,
  Brain, Check, X, ChevronRight
} from 'lucide-react';

const BG = '#050505';
const BG2 = '#0a0a0a';
const BG3 = '#111111';
const CYAN = '#00F5FF';
const CYAN_DIM = 'rgba(0,245,255,0.08)';
const RED = '#FF3B30';
const GOLD = '#D4AF37';
const HEAD = "'Inter Tight', sans-serif";
const MONO = "'Geist Mono', monospace";

const up = { hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0, transition: { duration: 0.65 } } };
const stg = { visible: { transition: { staggerChildren: 0.12 } } };

/* ═══════════════════ THREAT TICKER ═══════════════════ */
const SIGNALS = [
  { t: 'signal', s: 'SIGNAL: Client payment velocity declining', l: '14:02 AEST · SYD' },
  { t: 'pattern', s: 'PATTERN: Q3 pipeline concentration risk', l: '14:01 AEST · MEL' },
  { t: 'anomaly', s: 'ANOMALY: Resource utilisation above threshold', l: '13:58 AEST · BNE' },
  { t: 'intel', s: 'INTEL: Competitor pricing shift detected', l: '13:55 AEST · PER' },
  { t: 'signal', s: 'DRIFT: 3 deliverables overdue across 2 clients', l: '13:52 AEST · SYD' },
  { t: 'anomaly', s: 'CASH FLOW: Receivables ageing beyond 45 days', l: '13:49 AEST · ADL' },
];

const Ticker = () => (
  <div className="overflow-hidden py-3.5" style={{ borderTop: `1px solid rgba(0,245,255,0.1)`, borderBottom: `1px solid rgba(0,245,255,0.1)` }}>
    <div className="flex animate-ticker whitespace-nowrap">
      {[...SIGNALS, ...SIGNALS].map((s, i) => (
        <span key={i} className="inline-flex items-center gap-3 mx-8 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.t === 'anomaly' ? RED : CYAN, boxShadow: `0 0 8px ${s.t === 'anomaly' ? RED : CYAN}` }} />
          <span style={{ fontFamily: MONO, fontSize: 12, color: s.t === 'anomaly' ? RED : CYAN, letterSpacing: '0.03em' }}>{s.s}</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{s.l}</span>
        </span>
      ))}
    </div>
    <style>{`@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}.animate-ticker{animation:ticker 40s linear infinite}`}</style>
  </div>
);

/* ═══════════════════ COMPARISON ═══════════════════ */
const ROWS = [
  ['Speed to Insight', 'Weeks to months', 'Real-time continuous'],
  ['Data Sovereignty', 'Often offshore', '100% Australian'],
  ['Cost per Analysis', '$50K–$200K consulting', 'From $149/mo'],
  ['Predictive Capability', 'Reactive / historical', 'Proactive / predictive'],
  ['Implementation', '6–18 months', '2 minutes'],
  ['Expertise Required', 'Black Belt certified', 'Zero training needed'],
];

/* ═══════════════════ PRICING ═══════════════════ */
const TIERS = [
  { name: 'Analyst', price: '149', tag: 'For founders', feat: ['Continuous email & calendar monitoring', 'Weekly intelligence briefing', 'Business DNA profile', 'Pattern detection (5 signals)', '1 user seat'], cta: 'Start Free Trial', hl: false },
  { name: 'Strategist', price: '399', tag: 'Most popular', feat: ['Everything in Analyst', 'Real-time threat & opportunity alerts', 'Advisory Soundboard (AI sparring)', 'CRM & accounting integration', 'OAC recommendations engine', 'Up to 5 user seats'], cta: 'Start Free Trial', hl: true },
  { name: 'Sovereign', price: '899', tag: 'Full advisory', feat: ['Everything in Strategist', 'Dedicated Strategy Squad advisor', 'Board-ready intelligence memos', 'Custom integration pipeline', 'Unlimited seats', 'Priority Australian support'], cta: 'Contact Sales', hl: false },
];

/* ═══════════════════ PAGE ═══════════════════ */
const LandingIntelligent = () => {
  const nav = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: BG, color: '#fff' }}>

      {/* ─── NAV ─── */}
      <nav className="fixed top-0 inset-x-0 z-50" style={{ background: 'rgba(5,5,5,0.88)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-16 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center" style={{ background: CYAN }}>
              <span className="font-black text-sm" style={{ color: BG, fontFamily: HEAD }}>B</span>
            </div>
            <span className="font-bold text-base tracking-tight" style={{ fontFamily: HEAD }}>BIQc</span>
            <span className="text-[9px] tracking-[0.2em] uppercase hidden sm:inline" style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.25)' }}>Sovereign Intelligence</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => nav('/trust')} className="text-[13px] font-medium px-4 py-2 hidden sm:inline-flex" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: HEAD }} data-testid="nav-trust-link">Trust</button>
            <button onClick={() => nav('/login-supabase')} className="text-[13px] font-medium px-4 py-2" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: HEAD }} data-testid="nav-login">Log In</button>
            <button onClick={() => nav('/register-supabase')} className="text-[13px] font-semibold px-5 py-2" style={{ background: '#fff', color: BG, fontFamily: HEAD }} data-testid="nav-start-free">Start Free</button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="pt-32 sm:pt-40 pb-0 px-6 lg:px-16" data-testid="hero-section">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={stg} className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-20 items-start">

            {/* Left — Headline */}
            <div className="lg:col-span-3 space-y-10 pt-4">
              <motion.p variants={up} className="text-[11px] uppercase tracking-[0.25em]" style={{ fontFamily: MONO, color: CYAN }}>
                Australian Business Intelligence
              </motion.p>
              <motion.h1 variants={up} className="text-[3.2rem] sm:text-[4.2rem] lg:text-[5.5rem] font-black leading-[0.95] tracking-[-0.03em]" style={{ fontFamily: HEAD }}>
                Stop Reacting.<br />
                <span style={{ color: CYAN }}>Start Commanding.</span>
              </motion.h1>
              <motion.p variants={up} className="text-[17px] leading-[1.7] max-w-lg" style={{ color: 'rgba(255,255,255,0.55)' }}>
                BIQc continuously monitors your business across email, calendar, CRM, and operations — surfacing threats and opportunities before they become crises.
              </motion.p>
              <motion.div variants={up} className="flex flex-col sm:flex-row gap-3 pt-2">
                <button onClick={() => nav('/register-supabase')} className="px-8 py-4 text-[13px] font-bold tracking-wide flex items-center justify-center gap-2.5 transition-all hover:brightness-110" style={{ background: CYAN, color: BG, fontFamily: HEAD }} data-testid="hero-cta-primary">
                  Deploy Intelligence <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => nav('/trust')} className="px-8 py-4 text-[13px] font-semibold tracking-wide flex items-center justify-center gap-2.5" style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontFamily: HEAD }} data-testid="hero-cta-trust">
                  <Shield className="w-4 h-4" /> Australian Sovereign
                </button>
              </motion.div>
              <motion.div variants={up} className="flex items-center gap-6 pt-1">
                <span className="flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase" style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.2)' }}><Lock className="w-3 h-3" /> AES-256</span>
                <span className="flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase" style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.2)' }}><Shield className="w-3 h-3" /> AU Residency</span>
              </motion.div>
            </div>

            {/* Right — Intelligence Feed */}
            <motion.div variants={up} className="lg:col-span-2">
              <div className="rounded-md overflow-hidden" style={{ background: BG2, border: '1px solid rgba(0,245,255,0.08)' }}>
                <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: RED }} />
                  <span className="w-2 h-2 rounded-full" style={{ background: GOLD }} />
                  <span className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }} />
                  <span className="ml-auto text-[10px] tracking-[0.15em] uppercase" style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.2)' }}>Live Feed</span>
                </div>
                <div className="p-4 space-y-2">
                  {SIGNALS.slice(0, 5).map((s, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.25 }}
                      className="flex items-start gap-2.5 px-3 py-2.5 rounded" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: s.t === 'anomaly' ? RED : CYAN, boxShadow: `0 0 6px ${s.t === 'anomaly' ? RED : CYAN}` }} />
                      <div className="min-w-0">
                        <p className="text-[11px] leading-snug truncate" style={{ fontFamily: MONO, color: s.t === 'anomaly' ? RED : CYAN }}>{s.s}</p>
                        <p className="text-[9px] mt-0.5" style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.15)' }}>{s.l}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="h-10" style={{ background: `linear-gradient(transparent, ${BG2})` }} />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── TICKER ─── */}
      <div className="mt-20" data-testid="threat-ticker"><Ticker /></div>

      {/* ─── PROBLEM ─── */}
      <section className="py-28 sm:py-36 px-6 lg:px-16" style={{ background: BG2 }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-3xl mx-auto text-center space-y-7">
          <motion.h2 variants={up} className="text-[2.5rem] sm:text-[3.2rem] font-extrabold leading-[1.05] tracking-tight" style={{ fontFamily: HEAD }}>
            No single tool sees the<br />whole system.
          </motion.h2>
          <motion.p variants={up} className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            You're accountable for sales, operations, cash, capacity, and risk — but the signals that matter form across systems. Conversations stall. Commitments drift. Patterns emerge where no one is looking.
          </motion.p>
          <motion.p variants={up} className="text-lg font-bold" style={{ color: CYAN, fontFamily: HEAD }}>
            BIQc watches the system end-to-end.
          </motion.p>
        </motion.div>
      </section>

      {/* ─── INTELLIGENCE LAYER ─── */}
      <section className="py-28 sm:py-36 px-6 lg:px-16">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: Eye, title: 'Monitors Continuously', desc: 'Watches email, calendar, CRM, and operations. Builds context while you work.' },
            { icon: Brain, title: 'Detects Patterns', desc: 'Identifies what\'s recurring, drifting, or being deferred across disciplines.' },
            { icon: AlertTriangle, title: 'Surfaces What Matters', desc: 'Only escalates when a signal crosses the threshold of relevance.' },
          ].map((c, i) => (
            <motion.div key={i} variants={up} className="p-7 rounded-md group hover:border-[rgba(0,245,255,0.15)] transition-colors" style={{ background: BG3, border: '1px solid rgba(255,255,255,0.05)' }}>
              <c.icon className="w-5 h-5 mb-5" style={{ color: CYAN }} strokeWidth={1.5} />
              <h3 className="text-base font-bold mb-2 tracking-tight" style={{ fontFamily: HEAD }}>{c.title}</h3>
              <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ─── 6 SIGMA vs BIQc ─── */}
      <section className="py-28 sm:py-36 px-6 lg:px-16" style={{ background: BG2 }} data-testid="comparison-section">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-5xl mx-auto">
          <motion.div variants={up} className="text-center mb-16">
            <p className="text-[10px] uppercase tracking-[0.25em] mb-4" style={{ fontFamily: MONO, color: CYAN }}>Value Logic</p>
            <h2 className="text-[2.5rem] sm:text-[3.2rem] font-extrabold tracking-tight" style={{ fontFamily: HEAD }}>
              Traditional Consulting<br />vs. BIQc Intelligence
            </h2>
          </motion.div>
          <div className="rounded-md overflow-x-auto" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <table className="w-full border-collapse" style={{ minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th className="text-left py-4 px-6 text-[10px] uppercase tracking-[0.2em]" style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.25)' }}>Metric</th>
                  <th className="text-left py-4 px-6 text-[10px] uppercase tracking-[0.2em]" style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.25)' }}>Traditional 6 Sigma</th>
                  <th className="text-left py-4 px-6 text-[10px] uppercase tracking-[0.2em]" style={{ fontFamily: MONO, color: CYAN }}>BIQc AI</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([m, s, b], i) => (
                  <motion.tr key={i} variants={up} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td className="py-4 px-6 text-sm font-semibold" style={{ fontFamily: HEAD }}>{m}</td>
                    <td className="py-4 px-6 text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      <span className="inline-flex items-center gap-2"><X className="w-3.5 h-3.5" style={{ color: 'rgba(255,59,48,0.5)' }} />{s}</span>
                    </td>
                    <td className="py-4 px-6 text-[13px] font-semibold" style={{ color: CYAN, fontFamily: MONO }}>
                      <span className="inline-flex items-center gap-2"><Check className="w-3.5 h-3.5" />{b}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>

      {/* ─── PRICING ─── */}
      <section className="py-28 sm:py-36 px-6 lg:px-16" data-testid="pricing-section">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-6xl mx-auto">
          <motion.div variants={up} className="text-center mb-16">
            <p className="text-[10px] uppercase tracking-[0.25em] mb-4" style={{ fontFamily: MONO, color: CYAN }}>Strategy Squad Pricing</p>
            <h2 className="text-[2.5rem] sm:text-[3.2rem] font-extrabold tracking-tight mb-3" style={{ fontFamily: HEAD }}>Intelligence at every scale</h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>All prices in AUD. 14-day free trial. Cancel anytime.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TIERS.map((t, i) => (
              <motion.div key={i} variants={up} className="relative rounded-md p-[1px] h-full"
                style={{ background: t.hl ? `linear-gradient(160deg, ${CYAN}, rgba(0,245,255,0.2), ${CYAN})` : 'rgba(255,255,255,0.05)', boxShadow: t.hl ? `0 0 50px -12px rgba(0,245,255,0.25)` : 'none' }}>
                <div className="rounded-md p-8 h-full flex flex-col" style={{ background: t.hl ? BG2 : BG3 }}>
                  {t.hl && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-[9px] font-bold tracking-[0.2em] uppercase" style={{ fontFamily: MONO, background: CYAN, color: BG }}>Recommended</span>}
                  <p className="text-[9px] uppercase tracking-[0.2em] mb-2" style={{ fontFamily: MONO, color: t.hl ? CYAN : 'rgba(255,255,255,0.25)' }}>{t.tag}</p>
                  <h3 className="text-xl font-bold mb-1 tracking-tight" style={{ fontFamily: HEAD }}>{t.name}</h3>
                  <div className="flex items-baseline gap-0.5 mt-3 mb-6">
                    <span className="text-4xl font-black tracking-tight" style={{ fontFamily: HEAD }}>${t.price}</span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>/mo</span>
                  </div>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {t.feat.map((f, j) => (
                      <li key={j} className="flex items-start gap-2 text-[13px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: t.hl ? CYAN : 'rgba(255,255,255,0.2)' }} />{f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => nav(t.name === 'Sovereign' ? '/trust' : '/register-supabase')}
                    className="w-full py-3 text-[13px] font-bold tracking-wide transition-all"
                    style={{ background: t.hl ? CYAN : 'transparent', color: t.hl ? BG : '#fff', border: t.hl ? 'none' : '1px solid rgba(255,255,255,0.1)', fontFamily: HEAD }}
                    data-testid={`pricing-cta-${t.name.toLowerCase()}`}>{t.cta}</button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── TRUST TEASER ─── */}
      <section className="py-16 px-6 lg:px-16" style={{ background: BG2, borderTop: `1px solid rgba(0,245,255,0.06)`, borderBottom: `1px solid rgba(0,245,255,0.06)` }}>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 flex items-center justify-center rounded-md" style={{ background: CYAN_DIM, border: '1px solid rgba(0,245,255,0.15)' }}>
              <Lock className="w-5 h-5" style={{ color: CYAN }} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: HEAD }}>Australian Data Sovereignty</h3>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>AES-256 encryption. Your data never leaves Australian jurisdiction.</p>
            </div>
          </div>
          <button onClick={() => nav('/trust')} className="px-5 py-2.5 text-[12px] font-bold tracking-wide flex items-center gap-2 flex-shrink-0 transition-all hover:brightness-110"
            style={{ border: `1px solid ${CYAN}`, color: CYAN, fontFamily: HEAD }} data-testid="trust-teaser-cta">
            Enter The Vault <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-32 sm:py-40 px-6 lg:px-16">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-3xl mx-auto text-center space-y-8">
          <motion.h2 variants={up} className="text-[2.8rem] sm:text-[3.8rem] font-black leading-[0.95] tracking-tight" style={{ fontFamily: HEAD }}>
            Stop reacting.<br /><span style={{ color: CYAN }}>Start commanding.</span>
          </motion.h2>
          <motion.p variants={up} className="text-base" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Connect your systems. Let BIQc build context. Act with confidence.
          </motion.p>
          <motion.div variants={up}>
            <button onClick={() => nav('/register-supabase')} className="px-10 py-4 text-[13px] font-bold tracking-wide inline-flex items-center gap-2.5 transition-all hover:brightness-110"
              style={{ background: CYAN, color: BG, fontFamily: HEAD }} data-testid="final-cta">
              Deploy Intelligence <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
          <motion.p variants={up} className="text-[10px] tracking-[0.12em] uppercase" style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.15)' }}>
            Free to start · No credit card · Australian owned and operated
          </motion.p>
        </motion.div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-8 px-6 lg:px-16" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)', fontFamily: MONO }}>&copy; 2026 BIQc — Business IQ Centre. Powered by The Strategy Squad.</p>
          <button onClick={() => nav('/trust')} className="text-[11px] transition-colors" style={{ color: 'rgba(255,255,255,0.2)', fontFamily: MONO }}>Trust & Security</button>
        </div>
      </footer>
    </div>
  );
};

export default LandingIntelligent;
