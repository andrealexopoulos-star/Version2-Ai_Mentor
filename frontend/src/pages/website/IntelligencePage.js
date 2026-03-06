import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { ArrowRight, DollarSign, TrendingUp, Settings, Shield, Radar, Mail } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';


const categories = [
  {
    icon: DollarSign, color: '#FF6A00', title: 'Financial Data',
    items: ['Cash flow monitoring', 'Invoice tracking & aged receivables', 'Expense anomaly detection', 'Margin variance analysis', 'Tax liability flags', 'Runway projections'],
  },
  {
    icon: TrendingUp, color: '#3B82F6', title: 'Revenue & Sales Data',
    items: ['Pipeline velocity tracking', 'Lead conversion analysis', 'Revenue concentration risk', 'Customer churn prediction', 'Deal stall detection', 'Pricing optimisation signals'],
  },
  {
    icon: Settings, color: '#22C55E', title: 'Operational Data',
    items: ['Staff utilisation rates', 'Overtime anomaly detection', 'SOP compliance monitoring', 'Delivery timeline tracking', 'Bottleneck identification', 'Task aging & SLA breaches'],
  },
  {
    icon: Shield, color: '#8B5CF6', title: 'Risk & Compliance Data',
    items: ['Missing documentation alerts', 'Regulatory exposure detection', 'Policy drift monitoring', 'Certification expiry tracking', 'Audit trail maintenance', 'Compliance gap analysis'],
  },
  {
    icon: Radar, color: '#F59E0B', title: 'Market Signals',
    items: ['Competitor activity monitoring', 'Industry benchmark comparisons', 'Demand shift detection', 'Pricing position analysis', 'Market sentiment tracking', 'Regulatory change alerts'],
  },
  {
    icon: Mail, color: '#EF4444', title: 'Communication Signals',
    items: ['Email response pattern analysis', 'Response delay monitoring', 'Escalation trigger detection', 'Client engagement decline', 'Internal communication gaps', 'Sentiment shift detection'],
    note: 'Where authorised by the user',
  },
];

const IntelligencePage = () => (
  <WebsiteLayout>
    {/* HERO */}
    <section className="relative overflow-hidden" data-testid="intelligence-hero">
      <div className="absolute top-20 left-0 w-[400px] h-[400px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #FF6A00 0%, transparent 70%)' }} />
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-14 relative z-10">
        <div className="max-w-3xl">
          <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00] mb-6 block" style={{ fontFamily: fontFamily.mono }}>Intelligence Engine</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium leading-[1.2] mb-6 tracking-tight" style={{ fontFamily: fontFamily.displayING, color: '#FFFFFF' }}>
            Stop Checking Reports.<br /><span style={{ color: '#FF6A00' }}>Start Preventing Problems.</span>
          </h1>
          <p className="text-lg text-[#9FB0C3] mb-8 leading-relaxed max-w-xl" style={{ fontFamily: fontFamily.body }}>
            BIQc doesn't wait for you to ask. It monitors every data signal across your business and surfaces what matters — before it becomes a problem.
          </p>
        </div>
      </div>
    </section>

    {/* WHAT BIQC ANALYSES */}
    <section className="py-16" style={{ background: '#141C26' }} data-testid="analysis-grid">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-[2px]" style={{ background: '#FF6A00' }} />
          <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00]" style={{ fontFamily: fontFamily.mono }}>What BIQc Analyses</span>
        </div>
        <h2 className="text-3xl font-medium mb-4" style={{ fontFamily: fontFamily.displayING, color: '#FFFFFF' }}>Six categories of business intelligence.</h2>
        <p className="text-base text-[#9FB0C3] mb-12 max-w-xl" style={{ fontFamily: fontFamily.body }}>Every data point mapped, monitored, and cross-referenced autonomously.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat, i) => (
            <div key={i} className="rounded-2xl p-6 transition-all duration-300 hover:border-[#FF6A00]/20 group" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors" style={{ background: `${cat.color}15` }}>
                  <cat.icon className="w-5 h-5" style={{ color: cat.color }} />
                </div>
                <h3 className="text-base font-semibold" style={{ fontFamily: fontFamily.displayING, color: '#FFFFFF' }}>{cat.title}</h3>
              </div>
              <ul className="space-y-2">
                {cat.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2.5">
                    <div className="w-1 h-1 rounded-full mt-2 shrink-0" style={{ background: cat.color }} />
                    <span className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{item}</span>
                  </li>
                ))}
              </ul>
              {cat.note && (
                <p className="mt-4 text-[10px] text-[#9FB0C3]/40 italic" style={{ fontFamily: fontFamily.mono }}>{cat.note}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* HOW IT WORKS */}
    <section className="py-16" data-testid="how-it-works">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00] mb-4 block" style={{ fontFamily: fontFamily.mono }}>Intelligence Pipeline</span>
          <h2 className="text-3xl font-medium" style={{ fontFamily: fontFamily.displayING, color: '#FFFFFF' }}>From Raw Data to Executive Briefing</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[
            { num: '01', title: 'Ingest', desc: 'Securely connects and continuously syncs data from all your business platforms.' },
            { num: '02', title: 'Analyse', desc: 'Cross-references signals across financial, operational, revenue, and market data.' },
            { num: '03', title: 'Detect', desc: 'Identifies anomalies, risks, opportunities, and compliance gaps autonomously.' },
            { num: '04', title: 'Act', desc: 'Delivers prioritised alerts, drafted actions, and automated corrections.' },
          ].map((step, i) => (
            <div key={i} className="text-center relative">
              <div className="text-5xl font-bold mb-4" style={{ fontFamily: fontFamily.mono, color: 'rgba(255,106,0,0.15)' }}>{step.num}</div>
              <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: fontFamily.displayING, color: '#FFFFFF' }}>{step.title}</h3>
              <p className="text-sm text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{step.desc}</p>
              {i < 3 && <div className="hidden md:block absolute top-8 -right-3 w-6 text-[#9FB0C3]/20 text-lg">&rarr;</div>}
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-20" style={{ background: '#141C26' }}>
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-medium mb-4" style={{ fontFamily: fontFamily.displayING, color: '#FFFFFF' }}>See what your business is <span style={{ color: '#FF6A00' }}>really doing.</span></h2>
        <p className="text-base text-[#9FB0C3] mb-8" style={{ fontFamily: fontFamily.body }}>Start your 14-day trial. No credit card. Full intelligence from day one.</p>
        <Link to="/register-supabase" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white" style={{ background: 'linear-gradient(135deg, #FF6A00, #E85D00)', fontFamily: fontFamily.displayING, boxShadow: '0 8px 32px rgba(255,106,0,0.3)' }}>
          Try It For Free <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  </WebsiteLayout>
);

export default IntelligencePage;
