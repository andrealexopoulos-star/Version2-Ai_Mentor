import React from 'react';
import { useLocation } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { BookOpen, ArrowRight, ExternalLink, CheckCircle2, Plug, BarChart3, Target, Mail, Shield, Eye, TrendingUp } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const GUIDES = [
  {
    id: 'forensic-calibration',
    icon: Eye,
    color: '#FF6A00',
    title: 'Complete Forensic Calibration',
    why: 'Forensic Calibration tells BIQc your revenue ambition, growth timeline, risk appetite, and pricing confidence. Without this, drift analysis and misalignment scoring cannot activate.',
    unlocks: ['Strategic Drift Analysis', 'Misalignment Index', 'Goal Achievement Probability', 'Growth Signal Scoring'],
    steps: [
      { step: 'Navigate to Market Intelligence', detail: 'Go to the Market page from the sidebar under Intelligence.' },
      { step: 'Click "Begin Forensic Calibration"', detail: 'Scroll to the Forensic Market Calibration section. Super Admin users can access immediately.' },
      { step: 'Answer 7 weighted questions', detail: 'Revenue ambition, growth timeline, cohort intention, risk appetite, retention maturity, pricing confidence, channel dependency.' },
      { step: 'Review your strategic profile', detail: 'After completing, you\'ll see your Risk Profile, Revenue Ambition, Retention Maturity, and Pricing Confidence scores.' },
      { step: 'Return to Market Intelligence', detail: 'Your drift analysis and misalignment scores will begin populating automatically.' },
    ],
    path: '/market',
    time: '3 minutes',
  },
  {
    id: 'business-goals',
    icon: Target,
    color: '#3B82F6',
    title: 'Define Business Goals & KPIs',
    why: 'BIQc measures misalignment by comparing your stated goals against actual business behaviour. Without goals defined, the misalignment engine has no reference point.',
    unlocks: ['Misalignment Detection', 'Goal Achievement Probability', 'Strategic Alignment Check', 'Contradiction Detection'],
    steps: [
      { step: 'Navigate to Business DNA', detail: 'Go to Governance → Business DNA in the sidebar.' },
      { step: 'Complete the Strategy tab', detail: 'Define your mission, vision, short-term goals, and long-term goals.' },
      { step: 'Set revenue targets', detail: 'Enter your revenue targets, growth rate expectations, and timeline.' },
      { step: 'Define acquisition & retention KPIs', detail: 'Set target CAC, customer lifetime value, churn rate targets, and retention goals.' },
      { step: 'Save and return to Market', detail: 'BIQc will compare these targets against your actual data to detect misalignment.' },
    ],
    path: '/business-profile',
    time: '5 minutes',
  },
  {
    id: 'connect-crm',
    icon: TrendingUp,
    color: '#10B981',
    title: 'Connect Your CRM',
    why: 'CRM data powers your pipeline intelligence, deal velocity tracking, acquisition signal scoring, and competitive positioning analysis. Without it, BIQc cannot assess your revenue health.',
    unlocks: ['Pipeline Health', 'Acquisition Signal Score', 'Deal Velocity', 'Revenue Concentration Risk', 'Churn Detection'],
    steps: [
      { step: 'Navigate to Integrations', detail: 'Go to Systems → Integrations in the sidebar.' },
      { step: 'Find your CRM provider', detail: 'BIQc supports HubSpot, Salesforce, Pipedrive, and others via Merge.dev.' },
      { step: 'Click Connect', detail: 'You\'ll be redirected to authorise BIQc to access your CRM data.' },
      { step: 'Authorise read access', detail: 'BIQc needs read access to contacts, deals/opportunities, and companies.' },
      { step: 'Wait for initial sync', detail: 'First sync takes 2-5 minutes. Your Market Intelligence will update automatically.' },
    ],
    path: '/integrations',
    time: '2 minutes',
  },
  {
    id: 'connect-accounting',
    icon: BarChart3,
    color: '#F59E0B',
    title: 'Connect Your Accounting Tool',
    why: 'Financial data enables cash flow analysis, trust scoring, invoice tracking, and financial risk detection. Without it, BIQc flags "No accounting tool connected" as a blind spot.',
    unlocks: ['Cash Flow Analysis', 'Cash Runway Calculation', 'Overdue Invoice Alerts', 'Financial Risk Scoring', 'Trust Score'],
    steps: [
      { step: 'Navigate to Integrations', detail: 'Go to Systems → Integrations in the sidebar.' },
      { step: 'Find your accounting provider', detail: 'BIQc supports Xero, QuickBooks, MYOB, and others via Merge.dev.' },
      { step: 'Click Connect', detail: 'You\'ll be redirected to authorise BIQc to access your accounting data.' },
      { step: 'Authorise read access', detail: 'BIQc needs read access to invoices, payments, and transactions.' },
      { step: 'Wait for initial sync', detail: 'First sync takes 2-5 minutes. Financial intelligence will populate across all pages.' },
    ],
    path: '/integrations',
    time: '2 minutes',
  },
  {
    id: 'connect-email',
    icon: Mail,
    color: '#7C3AED',
    title: 'Connect Your Email',
    why: 'Email data enables communication pattern analysis, engagement scoring, response time tracking, and AI-powered email prioritisation. Without it, BIQc cannot assess retention signals from communication behaviour.',
    unlocks: ['Priority Inbox', 'Email Stress Index', 'Communication Pattern Analysis', 'Retention Signal from Engagement', 'AI Reply Suggestions'],
    steps: [
      { step: 'Navigate to Connect Email', detail: 'Go to the Connect Email page — accessible from the first-login notification or Settings.' },
      { step: 'Choose your provider', detail: 'BIQc supports Microsoft Outlook and Gmail.' },
      { step: 'Authorise access', detail: 'Click "Connect Outlook" or "Connect Gmail" and authorise in the popup.' },
      { step: 'Wait for email sync', detail: 'BIQc will sync your recent emails. This may take 5-10 minutes for the first sync.' },
      { step: 'Check Priority Inbox', detail: 'Navigate to Execution → Priority Inbox to see AI-prioritised emails.' },
    ],
    path: '/connect-email',
    time: '2 minutes',
  },
];

const KnowledgeBasePage = () => {
  const location = useLocation();
  const hash = location.hash?.replace('#', '');

  return (
    <DashboardLayout>
      <div className="max-w-[900px] space-y-8" style={{ fontFamily: BODY }} data-testid="knowledge-base-page">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>Knowledge Base</h1>
          <p className="text-sm text-[#9FB0C3]">Step-by-step guides to activate every intelligence layer in BIQc.</p>
        </div>

        {/* Quick status */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {GUIDES.map(g => (
            <a key={g.id} href={`#${g.id}`} className="p-3 rounded-lg text-center transition-all hover:bg-white/[0.03]"
              style={{ background: hash === g.id ? `${g.color}10` : '#141C26', border: `1px solid ${hash === g.id ? g.color + '40' : '#243140'}` }}>
              <g.icon className="w-5 h-5 mx-auto mb-1" style={{ color: g.color }} />
              <span className="text-[10px] text-[#9FB0C3] block" style={{ fontFamily: MONO }}>{g.time}</span>
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

              {/* What this unlocks */}
              <div className="mb-5 p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: guide.color, fontFamily: MONO }}>What This Unlocks</span>
                <div className="flex flex-wrap gap-2">
                  {guide.unlocks.map(u => (
                    <span key={u} className="text-[10px] px-2 py-1 rounded" style={{ color: '#9FB0C3', background: '#141C26', border: '1px solid #243140', fontFamily: MONO }}>{u}</span>
                  ))}
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                {guide.steps.map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: guide.color + '15' }}>
                      <span className="text-xs font-bold" style={{ color: guide.color, fontFamily: MONO }}>{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#F4F7FA]">{s.step}</p>
                      <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-5 pt-4" style={{ borderTop: '1px solid #243140' }}>
                <a href={guide.path} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: guide.color }}>
                  {guide.title.startsWith('Connect') ? 'Go to Integrations' : guide.title.startsWith('Define') ? 'Go to Business DNA' : guide.title.startsWith('Complete') ? 'Go to Market Intelligence' : 'Start'}
                  <ArrowRight className="w-4 h-4" />
                </a>
                <span className="text-[10px] text-[#64748B] ml-3" style={{ fontFamily: MONO }}>Estimated time: {guide.time}</span>
              </div>
            </Panel>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default KnowledgeBasePage;
