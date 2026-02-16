import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Shield, Lock, Eye, Brain, AlertTriangle, Check, X, ChevronRight,
  Zap, TrendingUp, Activity, Clock, DollarSign, Users, BarChart3,
  MessageSquare, Mic, Target, Radio, Crosshair, Gauge, FileText
} from 'lucide-react';

const AZ = '#007AFF';
const MINT = '#00D995';
const SL = '#1E293B';
const MU = '#64748B';
const HEAD = "'Inter Tight',sans-serif";
const MONO = "'JetBrains Mono',monospace";
const up = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [.22,1,.36,1] } } };
const stg = { visible: { transition: { staggerChildren: 0.07 } } };

const titanGlass = {
  background: 'rgba(255,255,255,0.45)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.35)',
  boxShadow: '0 24px 48px -12px rgba(0,0,0,0.06)',
};

/* ═══ GLOBAL STYLES ═══ */
const TitanStyles = () => (
  <style>{`
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes pulse-ring{0%{transform:scale(.95);opacity:.7}50%{transform:scale(1.05);opacity:1}100%{transform:scale(.95);opacity:.7}}
    @keyframes radar{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
    @keyframes heartbeat{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.8)}}
    @keyframes float-bg{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
    @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
    @keyframes slide-active{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
    .titan-card{position:relative;overflow:hidden}
    .titan-card::before{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.15) 45%,rgba(255,255,255,0.25) 50%,rgba(255,255,255,0.15) 55%,transparent 60%);background-size:200% 100%;opacity:0;transition:opacity .4s}
    .titan-card:hover::before{opacity:1;animation:shimmer 1.2s ease-in-out}
    .living-bg{background:radial-gradient(ellipse at 20% 0%,rgba(0,122,255,0.06),transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(0,217,149,0.05),transparent 50%),radial-gradient(ellipse at 50% 50%,rgba(0,122,255,0.03),transparent 40%);background-size:400% 400%;animation:float-bg 20s ease infinite}
  `}</style>
);

/* ═══ LIVE FEED ═══ */
const FEED = [
  { icon: Shield, l: 'ATO Compliance Check', s: 'OK', c: MINT },
  { icon: TrendingUp, l: 'Sales Velocity Deviation', s: 'Corrected', c: AZ },
  { icon: AlertTriangle, l: 'Cash Flow Forecast', s: 'Attention', c: '#F59E0B' },
  { icon: Activity, l: 'Client Retention Score', s: '94%', c: MINT },
  { icon: DollarSign, l: 'CAC Leak Detection', s: 'Clean', c: MINT },
];
const LiveFeed = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => { const t = setInterval(() => setIdx(p => (p + 1) % FEED.length), 3000); return () => clearInterval(t); }, []);
  return (
    <div className="space-y-2">
      {[0,1,2,3].map(i => {
        const f = FEED[(idx + i) % FEED.length];
        return (
          <motion.div key={`${idx}-${i}`} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-3">
              <f.icon className="w-4 h-4" style={{ color: AZ }} strokeWidth={1.5} />
              <span className="text-[13px] font-medium" style={{ color: SL, fontFamily: HEAD }}>{f.l}</span>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ fontFamily: MONO, color: f.c, background: `${f.c}10` }}>{f.s}</span>
          </motion.div>
        );
      })}
    </div>
  );
};

/* ═══ PASSIVE vs ACTIVE SLIDER ═══ */
const SigmaKiller = () => {
  const [active, setActive] = useState(false);
  return (
    <div className="space-y-10">
      <div className="flex items-center justify-center gap-4 mb-8">
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: !active ? '#94A3B8' : MU }}>Passive Analytics</span>
        <button onClick={() => setActive(!active)} className="relative w-16 h-8 rounded-full transition-all" style={{ background: active ? AZ : '#CBD5E1' }} data-testid="sigma-slider">
          <div className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all" style={{ left: active ? 34 : 2 }} />
        </button>
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ fontFamily: MONO, color: active ? AZ : MU }}>Agentic Resolution</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[320px]">
        {/* LEFT: Passive */}
        <div className="rounded-2xl p-8 transition-all duration-500" style={{ background: !active ? 'rgba(241,245,249,0.9)' : 'rgba(241,245,249,0.4)', opacity: !active ? 1 : 0.5, border: '1px solid rgba(0,0,0,0.06)' }}>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-4" style={{ fontFamily: MONO, color: '#94A3B8' }}>Passive Analytics (Requires Questions)</p>
          <div className="space-y-2">
            {['Revenue by Region', 'Q3 Pipeline Report', 'Staff Utilisation %', 'Churn Rate Trend'].map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
                <BarChart3 className="w-4 h-4" style={{ color: '#CBD5E1' }} strokeWidth={1.5} />
                <span className="text-[13px]" style={{ color: '#94A3B8', fontFamily: MONO }}>{r}</span>
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.04)', color: '#CBD5E1', fontFamily: MONO }}>Static</span>
              </div>
            ))}
          </div>
          <p className="text-[12px] mt-6 italic" style={{ color: '#94A3B8' }}>You ask. It waits. You interpret. You decide.</p>
        </div>
        {/* RIGHT: Active */}
        <div className="rounded-2xl p-8 transition-all duration-500 titan-card" style={{ background: active ? 'rgba(0,122,255,0.03)' : 'rgba(241,245,249,0.4)', opacity: active ? 1 : 0.5, border: `1px solid ${active ? 'rgba(0,122,255,0.15)' : 'rgba(0,0,0,0.06)'}`, boxShadow: active ? '0 0 40px -10px rgba(0,122,255,0.1)' : 'none' }}>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-4" style={{ fontFamily: MONO, color: active ? AZ : '#94A3B8' }}>Agentic Resolution (Delivers Answers)</p>
          <div className="space-y-2">
            {[
              { t: 'FORCE MEMO: Client #47 payment drift detected', s: 'Deploy Fix', c: '#F59E0B' },
              { t: 'ALERT: Pipeline over-concentrated in 2 accounts', s: 'Mitigate', c: AZ },
              { t: 'SOP BREACH: Onboarding step 3 skipped 4x', s: 'Enforce', c: '#EF4444' },
              { t: 'OPPORTUNITY: Competitor pricing gap — act now', s: 'Capture', c: MINT },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: active ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.02)', border: `1px solid ${active ? 'rgba(0,122,255,0.08)' : 'rgba(0,0,0,0.04)'}`, animation: active ? `slide-active 0.4s ease ${i * 0.1}s both` : 'none' }}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: active ? r.c : '#CBD5E1', boxShadow: active ? `0 0 6px ${r.c}` : 'none' }} />
                <span className="text-[12px] flex-1" style={{ fontFamily: MONO, color: active ? SL : '#94A3B8' }}>{r.t}</span>
                <button className="text-[10px] font-bold px-3 py-1 rounded-full transition-all" style={{ background: active ? `${r.c}15` : 'rgba(0,0,0,0.04)', color: active ? r.c : '#CBD5E1', fontFamily: MONO }}>{r.s}</button>
              </div>
            ))}
          </div>
          <p className="text-[12px] mt-6 font-medium" style={{ color: active ? AZ : '#94A3B8' }}>It watches. It decides. It pushes. You command.</p>
        </div>
      </div>
    </div>
  );
};

/* ═══ 4 PILLARS ═══ */
const HeartbeatLine = ({ color = AZ }) => (
  <div className="flex items-end gap-[2px] h-8">
    {Array.from({ length: 24 }).map((_, i) => (
      <div key={i} className="w-[3px] rounded-full" style={{ background: color, height: `${12 + Math.sin(i * 0.8) * 10 + Math.random() * 6}px`, opacity: 0.6 + Math.random() * 0.4, animation: `heartbeat ${0.8 + Math.random() * 0.4}s ease ${i * 0.05}s infinite` }} />
    ))}
  </div>
);
const RadarSweep = () => (
  <div className="relative w-24 h-24 mx-auto">
    <div className="absolute inset-0 rounded-full" style={{ border: `1px solid rgba(0,122,255,0.15)` }} />
    <div className="absolute inset-3 rounded-full" style={{ border: `1px solid rgba(0,122,255,0.1)` }} />
    <div className="absolute inset-6 rounded-full" style={{ border: `1px solid rgba(0,122,255,0.08)` }} />
    <div className="absolute inset-0 rounded-full overflow-hidden" style={{ animation: 'radar 3s linear infinite' }}>
      <div className="absolute top-0 left-1/2 w-1/2 h-1/2 origin-bottom-left" style={{ background: `conic-gradient(from 0deg, transparent, ${AZ}30)` }} />
    </div>
    <div className="absolute w-2 h-2 rounded-full" style={{ top: '25%', left: '60%', background: AZ, boxShadow: `0 0 6px ${AZ}` }} />
    <div className="absolute w-1.5 h-1.5 rounded-full" style={{ top: '55%', left: '30%', background: '#F59E0B', boxShadow: '0 0 6px #F59E0B' }} />
  </div>
);
const BoardroomGrid = () => {
  const agents = [
    { name: 'Finance', icon: DollarSign, x: 20, y: 15, color: MINT },
    { name: 'Ops', icon: Gauge, x: 75, y: 15, color: AZ },
    { name: 'Sales', icon: TrendingUp, x: 10, y: 70, color: '#F59E0B' },
    { name: 'Risk', icon: AlertTriangle, x: 50, y: 50, color: '#EF4444' },
    { name: 'Compliance', icon: Shield, x: 85, y: 70, color: MINT },
  ];
  return (
    <div className="relative h-40">
      {agents.map((a, i) => (
        <div key={i} className="absolute flex flex-col items-center gap-1" style={{ left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-50%,-50%)' }}>
          <div className="relative">
            <div className="absolute inset-0 rounded-full" style={{ animation: `pulse-ring 2s ease ${i * 0.3}s infinite`, background: `${a.color}20`, transform: 'scale(1.8)' }} />
            <div className="w-10 h-10 rounded-full flex items-center justify-center relative z-10" style={{ background: `${a.color}15`, border: `1px solid ${a.color}30` }}>
              <a.icon className="w-4 h-4" style={{ color: a.color }} strokeWidth={1.5} />
            </div>
          </div>
          <span className="text-[9px] font-semibold" style={{ fontFamily: MONO, color: MU }}>{a.name}</span>
        </div>
      ))}
    </div>
  );
};

/* ═══ ROTATING HEADLINE ═══ */
const PHRASES = [
  { text: 'dodge the chaos.', glow: '#EF4444' },
  { text: 'spot the cash leak.', glow: MINT },
  { text: 'fix the drift.', glow: AZ },
  { text: 'own your time.', glow: '#8B5CF6' },
];
const RotatingHeadline = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => { const t = setInterval(() => setIdx(p => (p + 1) % PHRASES.length), 3000); return () => clearInterval(t); }, []);
  return (
    <h1 className="text-[2.6rem] sm:text-[3rem] lg:text-[3.5rem] font-bold" style={{ fontFamily: HEAD, letterSpacing: '-0.02em', color: '#0A0F1E', lineHeight: 1.1 }} data-testid="rotating-headline">
      <span>The insight to</span>
      <br />
      <span className="relative inline-block overflow-hidden" style={{ height: '1.15em' }}>
        {PHRASES.map((p, i) => (
          <span key={i} className="absolute left-0 transition-all duration-500 ease-in-out" style={{
            opacity: i === idx ? 1 : 0,
            transform: i === idx ? 'translateY(0)' : i === (idx - 1 + PHRASES.length) % PHRASES.length ? 'translateY(-100%)' : 'translateY(100%)',
            background: `linear-gradient(135deg, ${AZ}, ${p.glow})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            {p.text}
          </span>
        ))}
      </span>
    </h1>
  );
};

/* ═══ INTEGRATION MARQUEE ═══ */
const LOGOS = ['HubSpot','Salesforce','Xero','Stripe','BambooHR','Slack','Microsoft 365','Google Workspace','Jira','Asana','Monday','Shopify','Zoom','Teams','QuickBooks'];
const IntegrationMarquee = () => (
  <div className="overflow-hidden py-2">
    <div className="flex whitespace-nowrap" style={{ animation: 'marquee 30s linear infinite' }}>
      {[...LOGOS, ...LOGOS].map((l, i) => (
        <div key={i} className="inline-flex items-center gap-2 mx-6 px-5 py-3 rounded-xl transition-all hover:opacity-100 hover:shadow-md cursor-default flex-shrink-0"
          style={{ opacity: 0.5, background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold" style={{ background: `${AZ}10`, color: AZ }}>{l[0]}</div>
          <span className="text-[12px] font-medium" style={{ fontFamily: HEAD, color: SL }}>{l}</span>
        </div>
      ))}
    </div>
  </div>
);

/* ═══ OUTCOMES (WIIFM) ═══ */
const OUTCOMES = [
  { icon: Clock, m: '15+', u: 'hours/week reclaimed', t: 'Reclaim Your Time', d: 'Stop being the "Chief Monitor." BIQc watches sales calls, staff output, and operational drift while you focus on the $10K tasks.', e: "Andre's frameworks prioritise your attention so you never waste a minute on noise.", a: AZ },
  { icon: DollarSign, m: '8–12%', u: 'profit bleed plugged', t: 'Plug Cashflow Leaks', d: 'Real-time detection of high CAC, zombie subscriptions, and ATO liability mismatches — before they hit your bank balance.', e: 'Automated financial "Red Lines" based on 3 years of proven SME advisory.', a: MINT },
  { icon: Users, m: '97%', u: 'SOP compliance', t: 'Enforce Operational Strength', d: 'AI detects when staff skip steps or leads go cold, triggering intervention before the client leaves a bad review. 24/7.', e: 'The tool enforces the Strategy Squad standard across your entire team.', a: AZ },
];

/* ═══ PRICING ═══ */
const TIERS = [
  { n: 'The Pulse', p: '149', tg: 'Sentinel monitoring', f: ['24/7 Sentinel Monitoring','Risk & anomaly alerts','Business DNA profile','Weekly intelligence briefing','Email & calendar integration','1 user seat'], ct: 'Deploy My Intelligence', hl: false },
  { n: 'The Strategist', p: '1,950', tg: 'Advisory calibration', f: ['Everything in The Pulse','Full BIQc Intelligence Matrix','Monthly Advisory Calibration with Andre','CRM & accounting integration','OAC recommendations engine','Board-ready intelligence memos','Up to 5 user seats'], ct: 'Deploy My Intelligence', hl: true },
  { n: 'The Sovereign', p: '5,500', tg: 'Full sentinel integration', f: ['Everything in The Strategist','Weekly Force Memo Execution','Daily mentoring sessions','Custom integration pipeline','Dedicated Strategy Squad advisor','Unlimited seats','Priority sovereign support'], ct: 'Contact Sales', hl: false },
];

/* ═══ BADGE ═══ */
const SovereignBadge = () => (
  <div className="fixed bottom-6 right-6 z-40" data-testid="sovereign-badge">
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/90 select-none" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, #D4AF37, ${AZ})` }}>
        <Shield className="w-3 h-3 text-white" strokeWidth={2} />
      </div>
      <span className="text-[11px] font-semibold tracking-wide" style={{ fontFamily: MONO, color: SL }}>Australian Sovereign Data</span>
    </div>
  </div>
);

/* ═══════════════════════ PAGE ═══════════════════════ */
const LandingIntelligent = () => {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-white relative living-bg" style={{ color: SL }}>
      <TitanStyles />
      <SovereignBadge />

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80" style={{ backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-16 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: AZ }}><span className="font-black text-sm text-white" style={{ fontFamily: HEAD }}>B</span></div>
            <span className="font-bold text-base tracking-tight" style={{ fontFamily: HEAD }}>BIQc</span>
            <span className="text-[9px] tracking-[0.18em] uppercase hidden sm:inline" style={{ fontFamily: MONO, color: MU }}>Sovereign Intelligence</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => nav('/trust')} className="text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-slate-50 hidden sm:inline-flex" style={{ color: MU, fontFamily: HEAD }} data-testid="nav-trust-link">Trust</button>
            <button onClick={() => nav('/login-supabase')} className="text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-slate-50" style={{ color: MU, fontFamily: HEAD }} data-testid="nav-login">Log In</button>
            <button onClick={() => nav('/register-supabase')} className="text-[13px] font-semibold px-5 py-2.5 rounded-lg text-white" style={{ background: AZ, fontFamily: HEAD, boxShadow: '0 4px 14px rgba(0,122,255,0.25)' }} data-testid="nav-start-free">Start Free</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative z-10 pt-32 sm:pt-40 pb-16 px-6 lg:px-16" data-testid="hero-section">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={stg} className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-7">
              <motion.div variants={up} className="space-y-5">
                <p className="text-[11px] uppercase tracking-[0.25em] font-semibold" style={{ fontFamily: MONO, color: AZ }}>Sovereign Business Intelligence</p>
                <RotatingHeadline />
              </motion.div>
              <motion.p variants={up} className="text-[1.15rem] leading-[1.75] max-w-lg" style={{ color: MU }}>
                Don't wait for end-of-month surprises. BIQc is the always-on mentor that alerts you to risks and opportunities in real-time. <span className="font-medium" style={{ color: SL }}>See it coming. Fix it fast. Get back to business.</span>
              </motion.p>
              <motion.div variants={up} className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => nav('/register-supabase')} className="px-8 py-4 text-[13px] font-semibold rounded-xl flex items-center justify-center gap-2.5 text-white" style={{ background: AZ, fontFamily: HEAD, boxShadow: '0 8px 24px rgba(0,122,255,0.3)' }} data-testid="hero-cta-primary">Start My Defense <ArrowRight className="w-4 h-4" /></button>
                <button onClick={() => nav('/trust')} className="titan-card px-8 py-4 text-[13px] font-semibold rounded-xl flex items-center justify-center gap-2.5" style={{ ...titanGlass, color: SL, fontFamily: HEAD }} data-testid="hero-cta-mentor"><Shield className="w-4 h-4" style={{ color: AZ }} /> Meet Your Mentor</button>
              </motion.div>
              <motion.div variants={up} className="flex items-center gap-3">
                <Lock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: MU }} strokeWidth={1.5} />
                <span className="text-[0.875rem]" style={{ fontFamily: MONO, color: '#64748B' }}>100% Sovereign. 0% Blind Spots.</span>
              </motion.div>
            </div>
            <motion.div variants={up}>
              <div className="rounded-2xl p-6 titan-card hero-glass-pulse" style={{ ...titanGlass }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full animate-pulse" style={{ background: MINT }} /><span className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ fontFamily: MONO, color: MU }}>Live Sentinel Feed</span></div>
                  <span className="text-[10px]" style={{ fontFamily: MONO, color: '#94A3B8' }}>AEST</span>
                </div>
                <LiveFeed />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* SIGMA KILLER: PASSIVE vs ACTIVE */}
      <section className="relative z-10 py-24 sm:py-32 px-6 lg:px-16" style={{ background: '#FAFCFE' }} data-testid="sigma-comparison">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-6xl mx-auto">
          <motion.div variants={up} className="text-center mb-10">
            <p className="text-[11px] uppercase tracking-[0.25em] font-semibold mb-4" style={{ fontFamily: MONO, color: AZ }}>Intelligence Evolution</p>
            <h2 className="text-[2rem] sm:text-[2.8rem] font-semibold leading-[1.08]" style={{ fontFamily: HEAD, letterSpacing: '-0.02em' }}>
              Dashboards Report the Past.<br /><span style={{ color: AZ }}>Agents Command the Future.</span>
            </h2>
            <p className="text-base mt-4 max-w-2xl mx-auto" style={{ color: MU }}>
              Tools like Sigma Computing are brilliant for analysts who want to ask questions. BIQc is for leaders who want the answers pushed to them before the crisis hits.
            </p>
          </motion.div>
          <motion.div variants={up}><SigmaKiller /></motion.div>
        </motion.div>
      </section>

      {/* WE DON'T REPLACE YOUR DATA */}
      <section className="relative z-10 py-20 px-6 lg:px-16" data-testid="integration-layer">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-4xl mx-auto">
          <motion.div variants={up} className="rounded-2xl p-10 titan-card" style={{ ...titanGlass }}>
            <div className="flex items-start gap-6">
              <div className="w-1 self-stretch flex-shrink-0 rounded-full" style={{ background: `linear-gradient(${AZ}, ${MINT})` }} />
              <div className="space-y-4">
                <p className="text-[11px] uppercase tracking-[0.25em] font-semibold" style={{ fontFamily: MONO, color: AZ }}>AI SME Mentoring Australia</p>
                <h2 className="text-2xl sm:text-3xl font-semibold" style={{ fontFamily: HEAD, letterSpacing: '-0.02em' }}>We don't replace your data. We wake it up.</h2>
                <p className="text-sm leading-[1.8]" style={{ color: MU }}>
                  BIQc connects to your existing data layers. While your BI tools store the history, BIQc scans it 24/7 for Threats, Drift, and Anomalies — turning raw rows into executive strategy.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* 4 PILLARS */}
      <section className="relative z-10 py-24 sm:py-32 px-6 lg:px-16" style={{ background: '#FAFCFE' }} data-testid="four-pillars">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-7xl mx-auto">
          <motion.div variants={up} className="text-center mb-14">
            <p className="text-[11px] uppercase tracking-[0.25em] font-semibold mb-4" style={{ fontFamily: MONO, color: AZ }}>The Functional Arsenal</p>
            <h2 className="text-[2rem] sm:text-[2.6rem] font-semibold" style={{ fontFamily: HEAD, letterSpacing: '-0.02em' }}>Four pillars of sovereign intelligence</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: 'The Boardroom', desc: '5 AI Agents — Finance, Ops, Sales, Risk, Compliance — debating your data in real time.', content: <BoardroomGrid /> },
              { title: 'The Strategic Console', desc: 'Live pulse lines for Cash Velocity, Staff Sentiment, and Compliance Risk.', content: <div className="space-y-3"><div className="flex items-center gap-3"><span className="text-[10px] w-20" style={{ fontFamily: MONO, color: MU }}>Cash</span><HeartbeatLine color={MINT} /></div><div className="flex items-center gap-3"><span className="text-[10px] w-20" style={{ fontFamily: MONO, color: MU }}>Sentiment</span><HeartbeatLine color={AZ} /></div><div className="flex items-center gap-3"><span className="text-[10px] w-20" style={{ fontFamily: MONO, color: MU }}>Compliance</span><HeartbeatLine color="#F59E0B" /></div></div> },
              { title: 'SoundBoard', desc: 'Voice-to-Strategy calibration. Speak your challenges, get structured action plans.', content: <div className="flex items-end justify-center gap-[3px] h-16">{Array.from({ length: 32 }).map((_, i) => <div key={i} className="w-[3px] rounded-full" style={{ background: `linear-gradient(${AZ}, ${MINT})`, height: `${8 + Math.abs(Math.sin(i * 0.4)) * 40}px`, opacity: 0.4 + Math.abs(Math.sin(i * 0.4)) * 0.6, animation: `heartbeat ${1 + Math.random() * 0.5}s ease ${i * 0.03}s infinite` }} />)}</div> },
              { title: 'BIQc Insights', desc: 'Radar-sweep detection of "Silent Killers" — forgotten invoices, SOP drift, compliance gaps.', content: <RadarSweep /> },
            ].map((p, i) => (
              <motion.div key={i} variants={up} className="rounded-2xl p-8 titan-card" style={{ ...titanGlass }}>
                <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: HEAD, letterSpacing: '-0.02em' }}>{p.title}</h3>
                <p className="text-[13px] mb-6" style={{ color: MU }}>{p.desc}</p>
                {p.content}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* INTEGRATION MARQUEE */}
      <section className="relative z-10 py-16 px-6 lg:px-16" data-testid="integration-marquee">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-semibold" style={{ fontFamily: HEAD, letterSpacing: '-0.02em' }}>BIQc speaks 500 languages. <span style={{ color: AZ }}>Your business is one.</span></h2>
          </div>
          <IntegrationMarquee />
        </div>
      </section>

      {/* OUTCOME MATRIX (WIIFM) — PRESERVED */}
      <section className="relative z-10 py-24 sm:py-32 px-6 lg:px-16" style={{ background: '#FAFCFE' }} data-testid="outcome-matrix">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-7xl mx-auto">
          <motion.div variants={up} className="text-center mb-14">
            <p className="text-[11px] uppercase tracking-[0.25em] font-semibold mb-4" style={{ fontFamily: MONO, color: AZ }}>Real-time Operational Sentinel</p>
            <h2 className="text-[2rem] sm:text-[2.6rem] font-semibold" style={{ fontFamily: HEAD, letterSpacing: '-0.02em' }}>What's in it for you?</h2>
          </motion.div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {OUTCOMES.map((o, i) => (
              <motion.div key={i} variants={up} className="rounded-2xl p-8 flex flex-col titan-card" style={{ ...titanGlass }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${o.a}10` }}><o.icon className="w-5 h-5" style={{ color: o.a }} strokeWidth={1.5} /></div>
                  <div><span className="text-2xl font-bold" style={{ fontFamily: HEAD, color: o.a }}>{o.m}</span><span className="text-[11px] ml-1.5" style={{ fontFamily: MONO, color: MU }}>{o.u}</span></div>
                </div>
                <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: HEAD, letterSpacing: '-0.02em' }}>{o.t}</h3>
                <p className="text-[13px] leading-relaxed mb-5 flex-1" style={{ color: MU }}>{o.d}</p>
                <div className="pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <p className="text-[12px] leading-relaxed italic" style={{ color: '#94A3B8' }}><span className="font-semibold not-italic" style={{ color: AZ }}>Mentor Edge:</span> {o.e}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* PRICING — PRESERVED */}
      <section className="relative z-10 py-24 sm:py-32 px-6 lg:px-16" data-testid="pricing-section">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-6xl mx-auto">
          <motion.div variants={up} className="text-center mb-14">
            <p className="text-[11px] uppercase tracking-[0.25em] font-semibold mb-4" style={{ fontFamily: MONO, color: AZ }}>Strategic Pricing Ladder</p>
            <h2 className="text-[2rem] sm:text-[2.6rem] font-semibold mb-3" style={{ fontFamily: HEAD, letterSpacing: '-0.02em' }}>Intelligence at every scale</h2>
            <p className="text-sm" style={{ color: MU }}>All prices in AUD. Cancel anytime. 14-day free trial on The Pulse.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TIERS.map((t, i) => (
              <motion.div key={i} variants={up} className="relative rounded-2xl p-[1px] h-full" style={{ background: t.hl ? `linear-gradient(160deg, ${AZ}, ${MINT})` : 'transparent' }}>
                <div className="rounded-2xl p-8 h-full flex flex-col bg-white" style={{ boxShadow: t.hl ? '0 24px 48px -12px rgba(0,122,255,0.1)' : '0 24px 48px -12px rgba(0,0,0,0.05)', border: t.hl ? 'none' : '1px solid rgba(0,0,0,0.06)' }}>
                  {t.hl && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[9px] font-bold tracking-[0.18em] uppercase text-white" style={{ fontFamily: MONO, background: AZ }}>Recommended</span>}
                  <p className="text-[9px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ fontFamily: MONO, color: t.hl ? AZ : MU }}>{t.tg}</p>
                  <h3 className="text-xl font-semibold" style={{ fontFamily: HEAD, letterSpacing: '-0.02em' }}>{t.n}</h3>
                  <div className="flex items-baseline gap-0.5 mt-3 mb-6"><span className="text-4xl font-bold" style={{ fontFamily: HEAD }}>${t.p}</span><span className="text-xs" style={{ color: MU }}>/mo</span></div>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {t.f.map((f, j) => <li key={j} className="flex items-start gap-2.5 text-[13px]" style={{ color: MU }}><Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: t.hl ? AZ : '#CBD5E1' }} />{f}</li>)}
                  </ul>
                  <button onClick={() => nav(t.n === 'The Sovereign' ? '/trust' : '/register-supabase')} className="w-full py-3.5 rounded-xl text-[13px] font-semibold" style={{ background: t.hl ? AZ : 'transparent', color: t.hl ? 'white' : SL, border: t.hl ? 'none' : '1px solid rgba(0,0,0,0.1)', fontFamily: HEAD, boxShadow: t.hl ? '0 4px 14px rgba(0,122,255,0.2)' : 'none' }} data-testid={`pricing-cta-${i}`}>{t.ct}</button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* TRUST TEASER — PRESERVED */}
      <section className="relative z-10 py-16 px-6 lg:px-16" style={{ background: '#FAFCFE' }}>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 p-8 rounded-2xl titan-card" style={{ ...titanGlass }}>
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${AZ}10` }}><Lock className="w-5 h-5" style={{ color: AZ }} /></div>
            <div>
              <h3 className="text-base font-semibold" style={{ fontFamily: HEAD }}>Australian Data Sovereignty</h3>
              <p className="text-xs mt-0.5" style={{ color: MU }}>Sydney/Melbourne nodes. AES-256. Zero leakage.</p>
            </div>
          </div>
          <button onClick={() => nav('/trust')} className="px-5 py-2.5 rounded-xl text-[12px] font-semibold flex items-center gap-2 text-white" style={{ background: AZ, fontFamily: HEAD, boxShadow: '0 4px 14px rgba(0,122,255,0.2)' }} data-testid="trust-teaser-cta">Enter The Vault <ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 py-28 sm:py-36 px-6 lg:px-16">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-3xl mx-auto text-center space-y-8">
          <motion.h2 variants={up} className="text-[2.2rem] sm:text-[3rem] font-semibold leading-[1.08]" style={{ fontFamily: HEAD, letterSpacing: '-0.02em' }}>Business clarity, <span style={{ color: AZ }}>mastered.</span></motion.h2>
          <motion.p variants={up} className="text-base" style={{ color: MU }}>Connect your systems. Let BIQc build context. Act with confidence.</motion.p>
          <motion.div variants={up}><button onClick={() => nav('/register-supabase')} className="px-10 py-4 rounded-xl text-[13px] font-semibold inline-flex items-center gap-2.5 text-white" style={{ background: AZ, fontFamily: HEAD, boxShadow: '0 8px 24px rgba(0,122,255,0.25)' }} data-testid="final-cta">Deploy My Intelligence <ArrowRight className="w-4 h-4" /></button></motion.div>
          <motion.p variants={up} className="text-[10px] tracking-[0.1em] uppercase font-medium" style={{ fontFamily: MONO, color: '#94A3B8' }}>Free to start · No credit card · Australian owned and operated</motion.p>
        </motion.div>
      </section>

      <footer className="relative z-10 py-8 px-6 lg:px-16" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px]" style={{ color: '#94A3B8', fontFamily: MONO }}>&copy; 2026 BIQc — Business IQ Centre. Powered by The Strategy Squad.</p>
          <button onClick={() => nav('/trust')} className="text-[11px] hover:text-slate-600" style={{ color: '#94A3B8', fontFamily: MONO }}>Trust & Security</button>
        </div>
      </footer>
    </div>
  );
};

export default LandingIntelligent;
