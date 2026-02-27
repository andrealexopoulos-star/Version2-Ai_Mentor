import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import DashboardLayout from '../components/DashboardLayout';
import WebsiteLayout from '../components/website/WebsiteLayout';
import { BookOpen, ArrowRight, ExternalLink, CheckCircle2, Plug, BarChart3, Target, Mail, Shield, Eye, TrendingUp, ChevronDown, ChevronUp, HelpCircle, Zap, Lock, AlertTriangle, Settings, Radar, Users, DollarSign } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const GUIDES = [
  {
    id: 'getting-started',
    icon: Zap,
    color: '#FF6A00',
    title: 'Getting Started with BIQc',
    why: 'BIQc is your sovereign intelligence platform. It monitors, analyses, and surfaces actionable business signals from your connected systems. This guide walks you through the core setup.',
    steps: [
      { step: 'Create your account', detail: 'Sign up with your business email. BIQc uses Australian-hosted authentication with military-grade encryption.' },
      { step: 'Enter your business domain', detail: 'BIQc scans your website to build an initial understanding of your business, industry, and competitive landscape.' },
      { step: 'Verify your identity', detail: 'Confirm your business details to ensure BIQc analyses the correct entity. You can edit or regenerate if needed.' },
      { step: 'Connect your integrations', detail: 'Link your CRM, accounting, and email tools. BIQc only reads data — it never modifies your systems.' },
      { step: 'View your intelligence dashboard', detail: 'Your BIQc Overview shows signals across Revenue, Money, Operations, People, and Market.' },
    ],
    time: '5 minutes',
  },
  {
    id: 'forensic-calibration',
    icon: Eye,
    color: '#3B82F6',
    title: 'Complete Forensic Calibration',
    why: 'Forensic Calibration tells BIQc your revenue ambition, growth timeline, risk appetite, and pricing confidence. Without this, drift analysis and misalignment scoring cannot activate.',
    unlocks: ['Strategic Drift Analysis', 'Misalignment Index', 'Goal Achievement Probability', 'Growth Signal Scoring'],
    steps: [
      { step: 'Navigate to Market Intelligence', detail: 'Go to the Market page from the sidebar under Intelligence.' },
      { step: 'Click "Begin Forensic Calibration"', detail: 'Scroll to the Forensic Market Calibration section.' },
      { step: 'Answer 7 weighted questions', detail: 'Revenue ambition, growth timeline, cohort intention, risk appetite, retention maturity, pricing confidence, channel dependency.' },
      { step: 'Review your strategic profile', detail: 'After completing, you\'ll see your Risk Profile, Revenue Ambition, Retention Maturity, and Pricing Confidence scores.' },
      { step: 'Return to Market Intelligence', detail: 'Your drift analysis and misalignment scores will begin populating automatically.' },
    ],
    path: '/market',
    time: '3 minutes',
  },
  {
    id: 'connect-crm',
    icon: TrendingUp,
    color: '#10B981',
    title: 'Connect Your CRM',
    why: 'CRM data powers pipeline intelligence, deal velocity tracking, acquisition signal scoring, and competitive positioning analysis. Without it, BIQc cannot assess your revenue health.',
    unlocks: ['Pipeline Health', 'Acquisition Signal Score', 'Deal Velocity', 'Revenue Concentration Risk', 'Churn Detection'],
    steps: [
      { step: 'Navigate to Integrations', detail: 'Go to Systems > Integrations in the sidebar.' },
      { step: 'Find your CRM provider', detail: 'BIQc supports HubSpot, Salesforce, Pipedrive, and others via Merge.dev.' },
      { step: 'Click Connect', detail: 'You\'ll be redirected to authorise BIQc to access your CRM data.' },
      { step: 'Authorise read access', detail: 'BIQc needs read access to contacts, deals/opportunities, and companies.' },
      { step: 'Wait for initial sync', detail: 'First sync takes 2-5 minutes. Your intelligence dashboard will update automatically.' },
    ],
    path: '/integrations',
    time: '2 minutes',
  },
  {
    id: 'connect-accounting',
    icon: DollarSign,
    color: '#F59E0B',
    title: 'Connect Your Accounting Tool',
    why: 'Financial data enables cash flow analysis, trust scoring, invoice tracking, and financial risk detection.',
    unlocks: ['Cash Flow Analysis', 'Cash Runway Calculation', 'Overdue Invoice Alerts', 'Financial Risk Scoring'],
    steps: [
      { step: 'Navigate to Integrations', detail: 'Go to Systems > Integrations in the sidebar.' },
      { step: 'Find your accounting provider', detail: 'BIQc supports Xero, QuickBooks, MYOB, and others via Merge.dev.' },
      { step: 'Click Connect', detail: 'You\'ll be redirected to authorise read access to your accounting data.' },
      { step: 'Wait for initial sync', detail: 'First sync takes 2-5 minutes. Financial intelligence will populate across the Money module.' },
    ],
    path: '/integrations',
    time: '2 minutes',
  },
  {
    id: 'connect-email',
    icon: Mail,
    color: '#7C3AED',
    title: 'Connect Your Email',
    why: 'Email data enables communication pattern analysis, engagement scoring, and AI-powered email prioritisation.',
    unlocks: ['Priority Inbox', 'Email Stress Index', 'Communication Pattern Analysis', 'AI Reply Suggestions'],
    steps: [
      { step: 'Navigate to Connect Email', detail: 'Go to the Connect Email page from Settings or first-login notification.' },
      { step: 'Choose your provider', detail: 'BIQc supports Microsoft Outlook and Gmail.' },
      { step: 'Authorise access', detail: 'Click "Connect Outlook" or "Connect Gmail" and authorise in the popup.' },
      { step: 'Wait for email sync', detail: 'BIQc will sync your recent emails. This may take 5-10 minutes for the first sync.' },
    ],
    path: '/connect-email',
    time: '2 minutes',
  },
  {
    id: 'understanding-dashboard',
    icon: Radar,
    color: '#059669',
    title: 'Understanding Your Dashboard',
    why: 'The BIQc Overview is your central intelligence hub. It organises signals across five modules, each reflecting a different dimension of your business.',
    steps: [
      { step: 'Revenue tab', detail: 'Shows pipeline value, deal velocity, churn signals, and concentration risk. Requires CRM connection.' },
      { step: 'Money tab', detail: 'Shows cash runway, margins, spend patterns, and financial risk. Requires accounting connection.' },
      { step: 'Operations tab', detail: 'Shows SOP compliance, SLA breaches, bottlenecks, and task aging. Requires CRM/PM tools.' },
      { step: 'People tab', detail: 'Shows founder capacity, fatigue index, calendar density, and email stress. Requires email connection.' },
      { step: 'Market tab', detail: 'Shows competitive positioning, market trends, and strategic drift. Powered by web intelligence and calibration.' },
    ],
    time: '3 minutes',
  },
  {
    id: 'data-security',
    icon: Shield,
    color: '#EF4444',
    title: 'Data Security & Privacy',
    why: 'BIQc is built with Australian data sovereignty as a founding principle. Your data never leaves Australian infrastructure.',
    steps: [
      { step: 'Australian hosting', detail: 'All data is stored and processed in Sydney and Melbourne data centres.' },
      { step: 'AES-256 encryption', detail: 'All data at rest and in transit is encrypted with military-grade AES-256 encryption.' },
      { step: 'Zero leakage architecture', detail: 'Each client has a siloed AI instance. Your data is never used to train models or shared with other users.' },
      { step: 'Read-only integrations', detail: 'BIQc only reads data from your connected systems. It never modifies, deletes, or writes to your tools.' },
      { step: 'Compliance', detail: 'BIQc is designed to meet Australian Privacy Act requirements and GDPR standards.' },
    ],
    time: '2 minutes',
  },
];

const FAQS = [
  { q: 'What is BIQc?', a: 'BIQc (Business Intelligence Quality Control) is a sovereign intelligence platform that connects to your business tools and surfaces actionable signals across revenue, operations, finance, people, and market positioning.' },
  { q: 'How does BIQc differ from a dashboard?', a: 'Unlike traditional dashboards that display static charts, BIQc uses cognitive AI to analyse patterns, detect drift, predict risks, and recommend specific actions based on your verified business data.' },
  { q: 'What integrations does BIQc support?', a: 'BIQc integrates with HubSpot, Salesforce, Pipedrive (CRM), Xero, QuickBooks, MYOB (Accounting), Gmail, Outlook (Email), and more via Merge.dev.' },
  { q: 'Is my data safe?', a: 'Yes. All data is hosted exclusively in Australian data centres (Sydney & Melbourne). We use AES-256 encryption, siloed AI instances per client, and read-only integrations. Your data is never used for model training.' },
  { q: 'What happens if I don\'t connect integrations?', a: 'BIQc will show "Connect integrations to view verified data" states. The platform never fabricates or assumes data. You\'ll see intelligence only from sources that are actually connected.' },
  { q: 'Can BIQc modify my CRM or accounting data?', a: 'No. BIQc uses read-only access for all integrations. It analyses and surfaces intelligence but never modifies your systems.' },
  { q: 'How accurate is the AI analysis?', a: 'BIQc surfaces signals from your verified, connected data. Market positioning analysis comes from real web intelligence. The platform clearly labels confidence levels and data sources for every insight.' },
  { q: 'Is there a free tier?', a: 'Yes. BIQc offers a complimentary market landscape assessment so you can experience the platform before committing. Visit the Pricing page for details.' },
  { q: 'How long does setup take?', a: 'Initial setup takes 5-10 minutes. Connect your business domain, verify your identity, and link your integrations. Intelligence starts populating within minutes of connecting tools.' },
  { q: 'Who is BIQc designed for?', a: 'BIQc is purpose-built for SMB founders, managing directors, and executive teams who need enterprise-grade business intelligence without the enterprise cost or complexity.' },
];

const FAQItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#141C26', border: '1px solid #243140' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors" data-testid={`faq-${q.substring(0,20).replace(/\s/g,'-').toLowerCase()}`}>
        <span className="text-sm font-medium text-[#F4F7FA] pr-4" style={{ fontFamily: BODY }}>{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-[#64748B] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#64748B] shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4" style={{ borderTop: '1px solid #243140' }}>
          <p className="text-sm text-[#9FB0C3] leading-relaxed pt-3" style={{ fontFamily: BODY }}>{a}</p>
        </div>
      )}
    </div>
  );
};

const KnowledgeBaseContent = () => {
  const location = useLocation();
  const hash = location.hash?.replace('#', '');

  return (
    <div className="max-w-[900px] mx-auto space-y-8 px-6 py-8" style={{ fontFamily: BODY }} data-testid="knowledge-base-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#F4F7FA] mb-2" style={{ fontFamily: HEAD, textShadow: '0 1px 8px rgba(0,0,0,0.5)', WebkitTextStroke: '0.3px #F4F7FA' }}>Knowledge Base</h1>
        <p className="text-sm text-[#9FB0C3]">Step-by-step guides to activate every intelligence layer in BIQc, plus frequently asked questions.</p>
      </div>

      {/* Quick Nav */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {GUIDES.map(g => (
          <a key={g.id} href={`#${g.id}`} className="p-3 rounded-lg text-center transition-all hover:bg-white/[0.03]"
            style={{ background: hash === g.id ? `${g.color}10` : '#141C26', border: `1px solid ${hash === g.id ? g.color + '40' : '#243140'}` }}>
            <g.icon className="w-5 h-5 mx-auto mb-1" style={{ color: g.color }} />
            <span className="text-[9px] text-[#9FB0C3] block" style={{ fontFamily: MONO }}>{g.time}</span>
          </a>
        ))}
      </div>

      {/* Guides */}
      {GUIDES.map(guide => (
        <div key={guide.id} id={guide.id} className="scroll-mt-20">
          <Panel>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: guide.color + '15' }}>
                <guide.icon className="w-5 h-5" style={{ color: guide.color }} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>{guide.title}</h2>
                <p className="text-sm text-[#9FB0C3] leading-relaxed">{guide.why}</p>
              </div>
            </div>

            {guide.unlocks && (
              <div className="mb-5 p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: guide.color, fontFamily: MONO }}>What This Unlocks</span>
                <div className="flex flex-wrap gap-2">
                  {guide.unlocks.map(u => (
                    <span key={u} className="text-[10px] px-2 py-1 rounded" style={{ color: '#9FB0C3', background: '#141C26', border: '1px solid #243140', fontFamily: MONO }}>{u}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {guide.steps.map((s, i) => (
                <div key={i} className="flex items-start gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: guide.color + '15' }}>
                    <span className="text-xs font-bold" style={{ color: guide.color, fontFamily: MONO }}>{i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#F4F7FA]">{s.step}</p>
                    <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {guide.path && (
              <div className="mt-5 pt-4" style={{ borderTop: '1px solid #243140' }}>
                <Link to={guide.path} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: guide.color }}>
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
                <span className="text-[10px] text-[#64748B] ml-3" style={{ fontFamily: MONO }}>Estimated time: {guide.time}</span>
              </div>
            )}
          </Panel>
        </div>
      ))}

      {/* FAQs */}
      <div id="faqs" className="scroll-mt-20">
        <div className="flex items-center gap-3 mb-4">
          <HelpCircle className="w-5 h-5 text-[#FF6A00]" />
          <h2 className="text-xl font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Frequently Asked Questions</h2>
        </div>
        <div className="space-y-2">
          {FAQS.map((faq, i) => <FAQItem key={i} {...faq} />)}
        </div>
      </div>

      {/* CTA */}
      <Panel className="text-center py-8">
        <h3 className="text-lg font-semibold text-[#F4F7FA] mb-2" style={{ fontFamily: HEAD }}>Ready to get started?</h3>
        <p className="text-sm text-[#9FB0C3] mb-4">Experience sovereign business intelligence in under 5 minutes.</p>
        <Link to="/register-supabase" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6A00' }} data-testid="kb-cta">
          Try It Free <ArrowRight className="w-4 h-4" />
        </Link>
      </Panel>
    </div>
  );
};

const KnowledgeBasePage = () => {
  const { user } = useSupabaseAuth();

  if (user) {
    return (
      <DashboardLayout>
        <KnowledgeBaseContent />
      </DashboardLayout>
    );
  }

  return (
    <WebsiteLayout>
      <div style={{ background: '#0F1720', minHeight: '100vh', paddingTop: '64px' }}>
        <KnowledgeBaseContent />
      </div>
    </WebsiteLayout>
  );
};

export default KnowledgeBasePage;
