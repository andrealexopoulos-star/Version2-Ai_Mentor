import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Shield, Lock, Brain, AlertTriangle, Check,
  Zap, TrendingUp, Activity, Clock, DollarSign, Users, BarChart3,
  Target, Gauge, FileText, ChevronRight, Mic, Radio
} from 'lucide-react';

/* ═══ DESIGN TOKENS ═══ */
const FONTS = {
  head: "'Outfit', sans-serif",
  body: "'DM Sans', sans-serif",
  mono: "'JetBrains Mono', 'Geist Mono', monospace",
};

/* ═══ ANIMATION VARIANTS ═══ */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

/* ═══ ROTATING HEADLINE ═══ */
const PHRASES = [
  { text: 'dodge the chaos.', color: '#e11d48' },
  { text: 'spot the cash leak.', color: '#059669' },
  { text: 'fix the drift.', color: '#2563eb' },
  { text: 'own your time.', color: '#7c3aed' },
];

const HeroHeadline = () => (
  <h1
    style={{ fontFamily: FONTS.head, letterSpacing: '-0.03em', lineHeight: 1.08 }}
    data-testid="rotating-headline"
  >
    <span className="block text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900">
      Instant, Secure
    </span>
    <span className="block text-5xl sm:text-6xl lg:text-7xl font-bold text-blue-600">
      Intelligence & Insight
    </span>
    <span className="block text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900">
      across your entire business.
    </span>
  </h1>
);

/* ═══ LIVE INTELLIGENCE PANEL ═══ */
const FEED_ITEMS = [
  { icon: Shield, label: 'ATO Compliance Check', status: 'OK', color: '#059669', bg: '#d1fae5' },
  { icon: TrendingUp, label: 'Sales Velocity Deviation', status: 'Corrected', color: '#2563eb', bg: '#dbeafe' },
  { icon: AlertTriangle, label: 'Cash Flow Forecast', status: 'Attention', color: '#d97706', bg: '#fef3c7' },
  { icon: Activity, label: 'Client Retention Score', status: '94%', color: '#059669', bg: '#d1fae5' },
  { icon: DollarSign, label: 'CAC Leak Detection', status: 'Clean', color: '#059669', bg: '#d1fae5' },
];

const LiveIntelligencePanel = () => {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveIdx(p => (p + 1) % FEED_ITEMS.length), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative">
      {/* Main card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl shadow-slate-200/60">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500" style={{ fontFamily: FONTS.mono }}>
              Live Sentinel Feed
            </span>
          </div>
          <span className="text-xs text-slate-400" style={{ fontFamily: FONTS.mono }}>AEST</span>
        </div>

        {/* Feed items */}
        <div className="space-y-2.5">
          {FEED_ITEMS.map((item, i) => {
            const Icon = item.icon;
            const isActive = i === activeIdx;
            return (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-500"
                style={{
                  background: isActive ? item.bg : '#f8fafc',
                  border: isActive ? `1px solid ${item.color}25` : '1px solid #f1f5f9',
                  transform: isActive ? 'scale(1.01)' : 'scale(1)',
                }}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: isActive ? item.color : '#94a3b8' }}
                    strokeWidth={1.8}
                  />
                  <span
                    className="text-sm font-medium"
                    style={{ color: isActive ? '#0f172a' : '#64748b', fontFamily: FONTS.body }}
                  >
                    {item.label}
                  </span>
                </div>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    color: item.color,
                    background: item.bg,
                    fontFamily: FONTS.mono,
                  }}
                >
                  {item.status}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bottom score bar */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500" style={{ fontFamily: FONTS.mono }}>Business Health Score</span>
            <span className="text-xs font-bold text-emerald-600" style={{ fontFamily: FONTS.mono }}>87/100</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-1000"
              style={{ width: '87%' }}
            />
          </div>
        </div>
      </div>

      {/* Floating badge */}
      <div className="absolute -bottom-4 -left-4 bg-slate-900 text-white rounded-2xl px-4 py-3 shadow-xl">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
          <span className="text-xs font-semibold" style={{ fontFamily: FONTS.body }}>AI Analysis Active</span>
        </div>
      </div>

      {/* Floating alert */}
      <div className="absolute -top-3 -right-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 shadow-lg">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" strokeWidth={2} />
          <span className="text-xs font-semibold text-amber-700" style={{ fontFamily: FONTS.mono }}>1 Alert</span>
        </div>
      </div>
    </div>
  );
};

/* ═══ COMPARISON SECTION: PASSIVE vs ACTIVE ═══ */
const ComparisonSection = () => {
  const [isActive, setIsActive] = useState(false);

  const passiveItems = ['Revenue by Region', 'Q3 Pipeline Report', 'Staff Utilisation %', 'Churn Rate Trend'];
  const activeItems = [
    { text: 'FORCE MEMO: Client #47 payment drift detected', action: 'Deploy Fix', color: '#d97706', bg: '#fef3c7' },
    { text: 'ALERT: Pipeline over-concentrated in 2 accounts', action: 'Mitigate', color: '#2563eb', bg: '#dbeafe' },
    { text: 'SOP BREACH: Onboarding step 3 skipped 4×', action: 'Enforce', color: '#e11d48', bg: '#ffe4e6' },
    { text: 'OPPORTUNITY: Competitor pricing gap — act now', action: 'Capture', color: '#059669', bg: '#d1fae5' },
  ];

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center justify-center gap-4 mb-10">
        <span
          className="text-xs font-semibold uppercase tracking-widest transition-colors"
          style={{ fontFamily: FONTS.mono, color: !isActive ? '#0f172a' : '#94a3b8' }}
        >
          Passive Analytics
        </span>
        <button
          onClick={() => setIsActive(!isActive)}
          className="relative w-14 h-7 rounded-full transition-all duration-300"
          style={{ background: isActive ? '#2563eb' : '#cbd5e1' }}
          data-testid="sigma-slider"
        >
          <div
            className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300"
            style={{ left: isActive ? 32 : 2 }}
          />
        </button>
        <span
          className="text-xs font-semibold uppercase tracking-widest transition-colors"
          style={{ fontFamily: FONTS.mono, color: isActive ? '#2563eb' : '#94a3b8' }}
        >
          Agentic Resolution
        </span>
      </div>

      {/* Side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Passive */}
        <div
          className="rounded-2xl p-6 border transition-all duration-500"
          style={{
            background: isActive ? '#f8fafc' : '#ffffff',
            borderColor: isActive ? '#f1f5f9' : '#e2e8f0',
            opacity: isActive ? 0.45 : 1,
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-4 text-slate-400" style={{ fontFamily: FONTS.mono }}>
            Requires Questions
          </p>
          <div className="space-y-2">
            {passiveItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                <BarChart3 className="w-4 h-4 text-slate-300" strokeWidth={1.5} />
                <span className="text-sm text-slate-400" style={{ fontFamily: FONTS.mono }}>{item}</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-400" style={{ fontFamily: FONTS.mono }}>Static</span>
              </div>
            ))}
          </div>
          <p className="text-xs mt-4 italic text-slate-400" style={{ fontFamily: FONTS.body }}>You ask. It waits. You interpret. You decide.</p>
        </div>

        {/* Active */}
        <div
          className="rounded-2xl p-6 border transition-all duration-500"
          style={{
            background: isActive ? '#eff6ff' : '#f8fafc',
            borderColor: isActive ? '#bfdbfe' : '#f1f5f9',
            opacity: isActive ? 1 : 0.45,
            boxShadow: isActive ? '0 0 40px -10px rgba(37,99,235,0.15)' : 'none',
          }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-4 transition-colors"
            style={{ fontFamily: FONTS.mono, color: isActive ? '#2563eb' : '#94a3b8' }}
          >
            Delivers Answers
          </p>
          <div className="space-y-2">
            {activeItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all"
                style={{
                  background: isActive ? '#ffffff' : '#f1f5f9',
                  borderColor: isActive ? '#e0edff' : '#f1f5f9',
                }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: isActive ? item.color : '#cbd5e1', boxShadow: isActive ? `0 0 6px ${item.color}` : 'none' }}
                />
                <span className="text-xs flex-1 text-slate-600" style={{ fontFamily: FONTS.mono }}>{item.text}</span>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ color: isActive ? item.color : '#94a3b8', background: isActive ? item.bg : '#f1f5f9', fontFamily: FONTS.mono }}
                >
                  {item.action}
                </span>
              </div>
            ))}
          </div>
          <p
            className="text-xs mt-4 font-semibold transition-colors"
            style={{ color: isActive ? '#2563eb' : '#94a3b8', fontFamily: FONTS.body }}
          >
            It watches. It decides. It pushes. You command.
          </p>
        </div>
      </div>
    </div>
  );
};

/* ═══ INTEGRATION LOGOS MARQUEE — with real brand colors ═══ */
const LOGO_ITEMS = [
  { name: 'HubSpot',           bg: '#FF7A59', color: '#fff', letter: 'H', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/HubSpot_Logo.svg/2560px-HubSpot_Logo.svg.png' },
  { name: 'Salesforce',        bg: '#00A1E0', color: '#fff', letter: 'S', img: 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Salesforce.com_logo.svg' },
  { name: 'Xero',              bg: '#13B5EA', color: '#fff', letter: 'X', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Xero_software_logo.svg/2560px-Xero_software_logo.svg.png' },
  { name: 'Stripe',            bg: '#635BFF', color: '#fff', letter: 'S', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/2560px-Stripe_Logo%2C_revised_2016.svg.png' },
  { name: 'Slack',             bg: '#4A154B', color: '#fff', letter: 'Sl', img: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg' },
  { name: 'Microsoft 365',     bg: '#D83B01', color: '#fff', letter: 'M', img: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Microsoft_Office_365_%282019%E2%80%93present%29.svg' },
  { name: 'Google Workspace',  bg: '#4285F4', color: '#fff', letter: 'G', img: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg' },
  { name: 'Shopify',           bg: '#96BF48', color: '#fff', letter: 'Sh', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Shopify_logo_2018.svg/2560px-Shopify_logo_2018.svg.png' },
  { name: 'QuickBooks',        bg: '#2CA01C', color: '#fff', letter: 'QB', img: null },
  { name: 'Zoom',              bg: '#2D8CFF', color: '#fff', letter: 'Z',  img: null },
  { name: 'Jira',              bg: '#0052CC', color: '#fff', letter: 'J',  img: null },
  { name: 'Monday',            bg: '#F64D25', color: '#fff', letter: 'M',  img: null },
  { name: 'BambooHR',          bg: '#73C41D', color: '#fff', letter: 'B',  img: null },
  { name: 'Asana',             bg: '#F06A6A', color: '#fff', letter: 'A',  img: null },
  { name: 'Teams',             bg: '#6264A7', color: '#fff', letter: 'T',  img: null },
];

const IntegrationMarquee = () => (
  <div className="overflow-hidden">
    <div
      className="flex whitespace-nowrap"
      style={{ animation: 'marquee 36s linear infinite' }}
    >
      {[...LOGO_ITEMS, ...LOGO_ITEMS].map((logo, i) => (
        <div
          key={i}
          className="inline-flex items-center gap-2.5 mx-4 px-5 py-3 rounded-xl bg-white border border-slate-100 shadow-sm flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          {logo.img ? (
            <img
              src={logo.img}
              alt={logo.name}
              className="h-5 w-auto object-contain"
              style={{ maxWidth: 28 }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: logo.bg, display: logo.img ? 'none' : 'flex' }}
          >
            {logo.letter}
          </div>
          <span className="text-sm font-medium text-slate-700" style={{ fontFamily: FONTS.body }}>{logo.name}</span>
        </div>
      ))}
    </div>
    <style>{`@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
  </div>
);

/* ═══ FEATURES / PILLARS ═══ */
const PILLARS = [
  {
    icon: Brain,
    title: 'The Boardroom',
    description: 'Five specialised AI agents — Finance, Ops, Sales, Risk, Compliance — continuously debate your data and push you the most critical decisions.',
    color: '#2563eb',
    bg: '#dbeafe',
    span: 'md:col-span-1',
  },
  {
    icon: Activity,
    title: 'Strategic Console',
    description: 'Live pulse tracking for Cash Velocity, Staff Sentiment, and Compliance Risk. See what\'s happening across your entire business in one view.',
    color: '#059669',
    bg: '#d1fae5',
    span: 'md:col-span-1',
  },
  {
    icon: Mic,
    title: 'SoundBoard',
    description: 'Voice-to-strategy calibration. Speak your challenges, get structured action plans built around your business context — not generic templates.',
    color: '#7c3aed',
    bg: '#ede9fe',
    span: 'md:col-span-1',
  },
  {
    icon: Target,
    title: 'BIQc Insights',
    description: 'Radar-sweep detection of "Silent Killers" — forgotten invoices, SOP drift, compliance gaps, and cash flow anomalies — before they become crises.',
    color: '#e11d48',
    bg: '#ffe4e6',
    span: 'md:col-span-1',
  },
];

/* ═══ OUTCOMES / WIIFM ═══ */
const OUTCOMES = [
  {
    icon: Clock,
    metric: '15+',
    unit: 'hours/week reclaimed',
    title: 'Reclaim Your Time',
    desc: 'Stop being the Chief Monitor. BIQc watches sales calls, staff output, and operational drift while you focus on the $10K tasks.',
    mentorEdge: "BIQc prioritises your attention so you never waste a minute on noise.",
    color: '#2563eb',
  },
  {
    icon: DollarSign,
    metric: '8–12%',
    unit: 'profit bleed plugged',
    title: 'Plug Cashflow Leaks',
    desc: 'Real-time detection of high CAC, zombie subscriptions, and tax liability mismatches — before they hit your bank balance.',
    mentorEdge: 'BIQc automates financial Red Lines based on proven SME advisory methodology.',
    color: '#059669',
  },
  {
    icon: Users,
    metric: '97%',
    unit: 'SOP compliance',
    title: 'Enforce Operational Strength',
    desc: 'AI detects when staff skip steps or leads go cold, triggering intervention before the client leaves a bad review. 24/7.',
    mentorEdge: 'The tool enforces the Strategy Squad standard across your entire team.',
    color: '#7c3aed',
  },
];

/* ═══ PRICING TIERS ═══ */
const TIERS = [
  {
    name: 'The Pulse',
    price: '149',
    tagline: 'Sentinel monitoring',
    features: ['24/7 Sentinel Monitoring', 'Risk & anomaly alerts', 'Business DNA profile', 'Weekly intelligence briefing', 'Email & calendar integration', '1 user seat'],
    cta: 'Deploy My Intelligence',
    highlight: false,
  },
  {
    name: 'The Strategist',
    price: '1,950',
    tagline: 'Advisory calibration',
    features: ['Everything in The Pulse', 'Full BIQc Intelligence Matrix', 'Monthly Advisory Calibration', 'CRM & accounting integration', 'OAC recommendations engine', 'Board-ready intelligence memos', 'Up to 5 user seats'],
    cta: 'Deploy My Intelligence',
    highlight: true,
  },
  {
    name: 'The Sovereign',
    price: '5,500',
    tagline: 'Full sentinel integration',
    features: ['Everything in The Strategist', 'Weekly Force Memo Execution', 'Daily mentoring sessions', 'Custom integration pipeline', 'Dedicated Strategy Squad advisor', 'Unlimited seats'],
    cta: 'Contact Sales',
    highlight: false,
  },
];

/* ═══════════════ MAIN PAGE ═══════════════ */
const LandingIntelligent = () => {
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: FONTS.body, color: '#1e293b' }}>

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <span className="text-sm font-black text-white" style={{ fontFamily: FONTS.head }}>B</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base text-slate-900 leading-none" style={{ fontFamily: FONTS.head }}>BIQc</span>
              <span className="text-[9px] uppercase tracking-widest text-slate-400 hidden sm:block" style={{ fontFamily: FONTS.mono }}>Sovereign Intelligence</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => nav('/trust')}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-100 transition-all hidden sm:flex"
              data-testid="nav-trust-link"
            >
              Trust
            </button>
            <button
              onClick={() => nav('/login-supabase')}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-100 transition-all"
              data-testid="nav-login"
            >
              Log In
            </button>
            <button
              onClick={() => nav('/register-supabase')}
              className="text-sm font-semibold text-white px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 transition-all hover:-translate-y-0.5 ml-1"
              data-testid="nav-start-free"
            >
              Start Free
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-28 sm:pt-36 pb-20 px-6 lg:px-12 bg-white relative" data-testid="hero-section">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-50 pointer-events-none" style={{ zIndex: 0 }} />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-violet-50 rounded-full blur-3xl opacity-30 pointer-events-none" style={{ zIndex: 0 }} />

        <div className="max-w-7xl mx-auto relative" style={{ zIndex: 1 }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">

            {/* Left — No motion initial hiding so content is immediately visible */}
            <div className="space-y-7">
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-widest"
                style={{ fontFamily: FONTS.mono }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Sovereign Business Intelligence
              </span>

              <RotatingHeadline />

              <p
                className="text-lg lg:text-xl leading-relaxed text-slate-600 max-w-lg"
                style={{ fontFamily: FONTS.body }}
              >
                Don't wait for end-of-month surprises. BIQc is the always-on intelligence layer that surfaces risks and opportunities in real time.{' '}
                <strong className="text-slate-900 font-semibold">See it coming. Fix it fast. Get back to business.</strong>
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => nav('/register-supabase')}
                  className="flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/30 transition-all hover:-translate-y-0.5"
                  style={{ fontFamily: FONTS.head }}
                  data-testid="hero-cta-primary"
                >
                  Start My Defense
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => nav('/trust')}
                  className="flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all"
                  style={{ fontFamily: FONTS.head }}
                  data-testid="hero-cta-secondary"
                >
                  <Shield className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
                  Meet Your Mentor
                </button>
              </div>

              <div className="flex items-center gap-2.5 text-slate-500">
                <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span className="text-sm" style={{ fontFamily: FONTS.mono }}>
                  100% Sovereign. 0% Blind Spots. Australian Owned.
                </span>
              </div>
            </div>

            {/* Right — Live Intelligence Panel */}
            <div className="relative">
              <LiveIntelligencePanel />
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST LOGOS STRIP ── */}
      <section className="py-12 bg-slate-50 border-y border-slate-200" data-testid="trust-strip">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6" style={{ fontFamily: FONTS.mono }}>
            BIQc speaks 500 languages. Your business is one.
          </p>
          <IntegrationMarquee />
        </div>
      </section>

      {/* ── COMPARISON: DASHBOARDS VS AGENTS ── */}
      <section className="py-24 px-6 lg:px-12 bg-white" data-testid="sigma-comparison">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
          className="max-w-6xl mx-auto"
        >
          <motion.div variants={fadeUp} className="text-center mb-12">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3 block" style={{ fontFamily: FONTS.mono }}>
              Intelligence Evolution
            </span>
            <h2 className="text-4xl md:text-5xl font-semibold text-slate-900 leading-[1.1] tracking-tight" style={{ fontFamily: FONTS.head }}>
              Dashboards report the past.
              <br />
              <span className="text-blue-600">Agents command the future.</span>
            </h2>
            <p className="text-base text-slate-500 mt-4 max-w-2xl mx-auto" style={{ fontFamily: FONTS.body }}>
              BI tools answer questions you ask. BIQc pushes answers to you before the crisis hits.
            </p>
          </motion.div>

          <motion.div variants={fadeUp}>
            <ComparisonSection />
          </motion.div>
        </motion.div>
      </section>

      {/* ── FOUR PILLARS ── */}
      <section className="py-24 px-6 lg:px-12 bg-slate-50" data-testid="four-pillars">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={stagger}
          className="max-w-7xl mx-auto"
        >
          <motion.div variants={fadeUp} className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3 block" style={{ fontFamily: FONTS.mono }}>
              The Functional Arsenal
            </span>
            <h2 className="text-4xl md:text-5xl font-semibold text-slate-900 leading-[1.1] tracking-tight" style={{ fontFamily: FONTS.head }}>
              Four pillars of sovereign intelligence
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PILLARS.map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="bg-white border border-slate-200 rounded-3xl p-8 hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300 group"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300"
                    style={{ background: pillar.bg }}
                  >
                    <Icon className="w-6 h-6" style={{ color: pillar.color }} strokeWidth={1.8} />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3" style={{ fontFamily: FONTS.head }}>
                    {pillar.title}
                  </h3>
                  <p className="text-base text-slate-500 leading-relaxed" style={{ fontFamily: FONTS.body }}>
                    {pillar.desc || pillar.description}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* "We don't replace your data" callout */}
          <motion.div
            variants={fadeUp}
            className="mt-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl p-8 text-white"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" strokeWidth={1.8} />
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-1 block" style={{ fontFamily: FONTS.mono }}>
                  AI SME Mentoring
                </span>
                <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: FONTS.head }}>
                  We don't replace your data. We wake it up.
                </h3>
                <p className="text-blue-100 text-sm leading-relaxed" style={{ fontFamily: FONTS.body }}>
                  BIQc connects to your existing tools and scans them 24/7 for threats, drift, and anomalies — turning raw rows into executive strategy.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── WIIFM / OUTCOMES ── */}
      <section className="py-24 px-6 lg:px-12 bg-white" data-testid="outcome-matrix">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={stagger}
          className="max-w-7xl mx-auto"
        >
          <motion.div variants={fadeUp} className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3 block" style={{ fontFamily: FONTS.mono }}>
              Real-World Impact
            </span>
            <h2 className="text-4xl md:text-5xl font-semibold text-slate-900 leading-[1.1] tracking-tight" style={{ fontFamily: FONTS.head }}>
              What's in it for you?
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {OUTCOMES.map((outcome, i) => {
              const Icon = outcome.icon;
              return (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${outcome.color}12` }}>
                      <Icon className="w-5 h-5" style={{ color: outcome.color }} strokeWidth={1.8} />
                    </div>
                    <div>
                      <span className="text-2xl font-bold" style={{ fontFamily: FONTS.head, color: outcome.color }}>{outcome.metric}</span>
                      <span className="text-xs ml-1.5 text-slate-500" style={{ fontFamily: FONTS.mono }}>{outcome.unit}</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-900 mb-3" style={{ fontFamily: FONTS.head }}>
                    {outcome.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-5 flex-1" style={{ fontFamily: FONTS.body }}>
                    {outcome.desc}
                  </p>

                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400 leading-relaxed" style={{ fontFamily: FONTS.body }}>
                      <span className="font-semibold not-italic" style={{ color: outcome.color }}>Mentor Edge: </span>
                      {outcome.mentorEdge}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-24 px-6 lg:px-12 bg-slate-50" data-testid="pricing-section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={stagger}
          className="max-w-6xl mx-auto"
        >
          <motion.div variants={fadeUp} className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3 block" style={{ fontFamily: FONTS.mono }}>
              Strategic Pricing Ladder
            </span>
            <h2 className="text-4xl md:text-5xl font-semibold text-slate-900 leading-[1.1] tracking-tight" style={{ fontFamily: FONTS.head }}>
              Intelligence at every scale
            </h2>
            <p className="text-sm text-slate-500 mt-3" style={{ fontFamily: FONTS.body }}>
              All prices in AUD. Cancel anytime. 14-day free trial on The Pulse.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TIERS.map((tier, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className={`relative rounded-3xl p-8 flex flex-col transition-all duration-300 ${
                  tier.highlight
                    ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/30'
                    : 'bg-white border border-slate-200 hover:shadow-xl hover:shadow-slate-200/60'
                }`}
              >
                {tier.highlight && (
                  <span
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white bg-blue-600 shadow-lg"
                    style={{ fontFamily: FONTS.mono }}
                  >
                    Recommended
                  </span>
                )}

                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ fontFamily: FONTS.mono, color: tier.highlight ? '#93c5fd' : '#64748b' }}
                >
                  {tier.tagline}
                </p>
                <h3 className="text-xl font-semibold mb-4" style={{ fontFamily: FONTS.head }}>
                  {tier.name}
                </h3>

                <div className="flex items-baseline gap-1 mb-7">
                  <span className="text-4xl font-bold" style={{ fontFamily: FONTS.head }}>${tier.price}</span>
                  <span className={`text-sm ${tier.highlight ? 'text-slate-400' : 'text-slate-500'}`}>/mo</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm">
                      <Check
                        className="w-4 h-4 mt-0.5 flex-shrink-0"
                        style={{ color: tier.highlight ? '#60a5fa' : '#2563eb' }}
                        strokeWidth={2}
                      />
                      <span style={{ color: tier.highlight ? '#cbd5e1' : '#64748b', fontFamily: FONTS.body }}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => nav(tier.name === 'The Sovereign' ? '/trust' : '/register-supabase')}
                  className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all ${
                    tier.highlight
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                  style={{ fontFamily: FONTS.head }}
                  data-testid={`pricing-cta-${i}`}
                >
                  {tier.cta}
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── AUSTRALIAN DATA SOVEREIGNTY ── */}
      <section className="py-16 px-6 lg:px-12 bg-white" data-testid="sovereignty-section">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 sm:p-10 text-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-7 h-7 text-white" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: FONTS.head }}>
                    Australian Data Sovereignty
                  </h3>
                  <p className="text-sm text-slate-300" style={{ fontFamily: FONTS.body }}>
                    Sydney/Melbourne nodes. AES-256 encryption. Zero data leakage. 100% Australian owned and operated.
                  </p>
                </div>
              </div>
              <button
                onClick={() => nav('/trust')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex-shrink-0"
                style={{ fontFamily: FONTS.head }}
                data-testid="trust-teaser-cta"
              >
                Enter The Vault
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-28 px-6 lg:px-12 bg-slate-50">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={stagger}
          className="max-w-3xl mx-auto text-center"
        >
          <motion.div variants={fadeUp}>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-6 block" style={{ fontFamily: FONTS.mono }}>
              Ready to take control?
            </span>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="text-5xl sm:text-6xl font-bold text-slate-900 leading-[1.08] tracking-tight mb-6"
            style={{ fontFamily: FONTS.head }}
          >
            Business clarity,{' '}
            <span className="text-blue-600">mastered.</span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="text-lg text-slate-500 mb-8 max-w-xl mx-auto"
            style={{ fontFamily: FONTS.body }}
          >
            Connect your systems. Let BIQc build context. Act with confidence.
          </motion.p>
          <motion.div variants={fadeUp}>
            <button
              onClick={() => nav('/register-supabase')}
              className="inline-flex items-center gap-2.5 px-10 py-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/30 transition-all hover:-translate-y-0.5"
              style={{ fontFamily: FONTS.head }}
              data-testid="final-cta"
            >
              Deploy My Intelligence
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
          <motion.p
            variants={fadeUp}
            className="text-xs text-slate-400 mt-5 uppercase tracking-widest"
            style={{ fontFamily: FONTS.mono }}
          >
            Free to start · No credit card · Australian owned and operated
          </motion.p>
        </motion.div>
      </section>

      {/* ── LEGAL DISCLAIMER ── */}
      <section className="py-6 px-6 bg-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-400 text-xs leading-relaxed" style={{ fontFamily: FONTS.body }}>
            <strong className="text-slate-300">Important:</strong> The Strategy Squad provides general information and educational content only.
            It does not constitute financial, legal, tax, or professional advice. You should seek independent professional advice
            before making any business decisions. See our{' '}
            <button onClick={() => nav('/terms')} className="text-blue-400 hover:underline">Terms and Conditions</button> for full details.
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 px-6 lg:px-12 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <span className="text-sm font-black text-white" style={{ fontFamily: FONTS.head }}>B</span>
            </div>
            <span className="text-sm font-semibold text-white" style={{ fontFamily: FONTS.head }}>BIQc</span>
            <span className="text-slate-600 hidden sm:inline">—</span>
            <span className="text-xs text-slate-500 hidden sm:inline" style={{ fontFamily: FONTS.body }}>Business IQ Centre. Powered by The Strategy Squad.</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => nav('/pricing')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors" style={{ fontFamily: FONTS.body }}>Pricing</button>
            <button onClick={() => nav('/trust')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors" style={{ fontFamily: FONTS.body }}>Trust & Security</button>
            <button onClick={() => nav('/terms')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors" style={{ fontFamily: FONTS.body }}>Terms</button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-6 mt-6 border-t border-slate-800">
          <p className="text-xs text-slate-600 text-center" style={{ fontFamily: FONTS.mono }}>
            © 2026 The Strategy Squad Pty Ltd. All rights reserved. · General Information Only · Not Professional Advice
          </p>
        </div>
      </footer>

      {/* ── SOVEREIGN BADGE (floating) ── */}
      <div className="fixed bottom-6 right-6 z-40" data-testid="sovereign-badge">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white border border-slate-200 shadow-lg">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-blue-600 flex items-center justify-center">
            <Shield className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xs font-semibold text-slate-700" style={{ fontFamily: FONTS.mono }}>
            Australian Sovereign Data
          </span>
        </div>
      </div>
    </div>
  );
};

export default LandingIntelligent;
