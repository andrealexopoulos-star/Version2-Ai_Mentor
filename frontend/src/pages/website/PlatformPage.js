import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { ArrowRight, AlertTriangle, BarChart3, Zap, Users, Eye, RefreshCw, Settings, Cpu, Workflow } from 'lucide-react';

const HEADING = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";

const GlassCard = ({ children, className = '' }) => (
  <div className={`rounded-2xl p-6 transition-all duration-300 hover:border-[#FF6A00]/20 ${className}`}
    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
    {children}
  </div>
);

const PlatformPage = () => (
  <WebsiteLayout>
    {/* HERO */}
    <section className="relative overflow-hidden" data-testid="platform-hero">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-8" style={{ background: 'radial-gradient(circle, #FF6A00 0%, transparent 70%)', opacity: 0.06 }} />
      <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 relative z-10">
        <div className="max-w-3xl">
          <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00] mb-6 block" style={{ fontFamily: MONO }}>The Platform</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.2] mb-6 tracking-tight" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>
            Run Your Business With Enterprise-Level Intelligence <span className="block" style={{ fontSize: '0.65em', color: '#CBD5E1' }}>&mdash; Without Hiring Enterprise Headcount.</span>
          </h1>
          <p className="text-lg text-[#9FB0C3] mb-8 leading-relaxed max-w-xl" style={{ fontFamily: BODY }}>
            BIQc connects your systems, builds unified business context, and deploys autonomous agents that monitor, detect, and correct &mdash; before problems compound.
          </p>
          <Link to="/register-supabase" className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #FF6A00, #E85D00)', fontFamily: HEADING, boxShadow: '0 8px 32px rgba(255,106,0,0.3)' }} data-testid="platform-cta">
            Start free trial <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>

    {/* THE PROBLEM */}
    <section className="py-24" style={{ background: '#141C26' }} data-testid="problem-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-[2px]" style={{ background: '#FF6A00' }} />
          <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00]" style={{ fontFamily: MONO }}>The Problem SMBs Face</span>
        </div>
        <h2 className="text-3xl font-bold mb-10" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>You&rsquo;re running a business with enterprise-level complexity on startup-level infrastructure.</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {[
            { icon: AlertTriangle, title: 'Too Many Disconnected Tools', desc: 'Your accounting, CRM, email, project management, and payroll all operate in silos. No single source of truth.' },
            { icon: Eye, title: 'No Central Oversight', desc: 'Critical information scattered across platforms. Decisions made on partial data. Blind spots everywhere.' },
            { icon: RefreshCw, title: 'Reactive Decision-Making', desc: 'You discover problems after they happen. Cash flow gaps, churn signals, compliance issues &mdash; always too late.' },
            { icon: BarChart3, title: 'Hidden Financial Leaks', desc: 'Margin compression, overdue invoices, cost blowouts &mdash; buried in spreadsheets nobody reviews weekly.' },
          ].map((item, i) => (
            <GlassCard key={i}>
              <item.icon className="w-5 h-5 text-[#EF4444] mb-3" />
              <h3 className="text-base font-semibold mb-2" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>{item.title}</h3>
              <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: BODY }}>{item.desc}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>

    {/* WHAT BIQC DOES */}
    <section className="py-24" data-testid="solution-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-[2px]" style={{ background: '#FF6A00' }} />
          <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00]" style={{ fontFamily: MONO }}>What BIQc Does</span>
        </div>
        <h2 className="text-3xl font-bold mb-10" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>Six layers of autonomous intelligence.</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Workflow, title: 'Connects Your Systems', desc: 'Secure OAuth integration with your accounting, CRM, communication, and HR platforms. One unified data layer.', num: '01' },
            { icon: Cpu, title: 'Builds Unified Context', desc: 'Cross-references data across all connected platforms to create a single, holistic view of your business.', num: '02' },
            { icon: Eye, title: 'Monitors In Real Time', desc: 'Always-on sentinel that watches cash flow, revenue signals, operational metrics, and market movements 24/7.', num: '03' },
            { icon: AlertTriangle, title: 'Flags Anomalies', desc: 'Detects overdue invoices, engagement decline, SOP breaches, margin compression, and compliance gaps automatically.', num: '04' },
            { icon: Zap, title: 'Recommends Actions', desc: 'Generates specific, actionable recommendations with drafted communications, prioritised by urgency and impact.', num: '05' },
            { icon: Settings, title: 'Automates Correction', desc: 'Can execute corrective workflows &mdash; sending follow-ups, creating tasks, escalating alerts &mdash; without manual intervention.', num: '06' },
          ].map((item, i) => (
            <GlassCard key={i}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,106,0,0.1)' }}>
                  <item.icon className="w-5 h-5 text-[#FF6A00]" />
                </div>
                <span className="text-2xl font-bold text-[#9FB0C3]/10" style={{ fontFamily: MONO }}>{item.num}</span>
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>{item.title}</h3>
              <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: BODY }}>{item.desc}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>

    {/* ARCHITECTURE DIAGRAM */}
    <section className="py-24" style={{ background: '#141C26' }} data-testid="architecture-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00] mb-4 block" style={{ fontFamily: MONO }}>Visual Architecture</span>
          <h2 className="text-3xl font-bold" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>How It All Connects</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* LEFT: Inputs */}
          <GlassCard>
            <h4 className="text-xs font-semibold tracking-widest uppercase text-[#FF6A00]/70 mb-5" style={{ fontFamily: MONO }}>Your Systems</h4>
            <div className="space-y-2">
              {[
                { cat: 'Accounting', items: ['Xero', 'MYOB'] },
                { cat: 'CRM', items: ['HubSpot', 'Salesforce'] },
                { cat: 'Payments', items: ['Stripe', 'Square'] },
                { cat: 'Commerce', items: ['Shopify'] },
                { cat: 'Comms', items: ['Google Workspace', 'Microsoft 365', 'Slack'] },
                { cat: 'HR', items: ['Payroll Platforms'] },
              ].map((group) => (
                <div key={group.cat}>
                  <span className="text-[10px] text-[#9FB0C3]/40 uppercase tracking-wider" style={{ fontFamily: MONO }}>{group.cat}</span>
                  <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                    {group.items.map((name) => (
                      <span key={name} className="text-[11px] px-2.5 py-1 rounded-md text-[#9FB0C3] hover:text-white hover:bg-[#FF6A00]/10 transition-all cursor-default" style={{ fontFamily: MONO, border: '1px solid rgba(255,255,255,0.08)' }}>{name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* CENTER */}
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full mb-3" style={{ background: 'rgba(255,106,0,0.2)' }}>
              <div className="w-full h-full rounded-full animate-ping" style={{ background: 'rgba(255,106,0,0.3)' }} />
            </div>
            <div className="w-[2px] h-10" style={{ background: 'linear-gradient(to bottom, #FF6A00, transparent)' }} />
            <div className="relative my-4">
              <div className="w-36 h-36 rounded-full flex items-center justify-center" style={{ background: 'radial-gradient(circle at 35% 35%, #2A3444, #0F1720)', border: '2px solid rgba(255,106,0,0.3)', boxShadow: '0 0 80px rgba(255,106,0,0.12)' }}>
                <div className="text-center">
                  <span className="text-2xl font-bold text-[#FF6A00]" style={{ fontFamily: MONO }}>BIQc</span>
                  <span className="block text-[10px] text-[#9FB0C3]/50 mt-0.5" style={{ fontFamily: MONO }}>Core Engine</span>
                </div>
              </div>
            </div>
            <div className="w-[2px] h-10" style={{ background: 'linear-gradient(to bottom, transparent, #FF6A00)' }} />
            <div className="w-6 h-6 rounded-full mt-3" style={{ background: 'rgba(255,106,0,0.2)' }}>
              <div className="w-full h-full rounded-full animate-ping" style={{ background: 'rgba(255,106,0,0.3)', animationDelay: '1s' }} />
            </div>
          </div>

          {/* RIGHT: Outputs */}
          <GlassCard>
            <h4 className="text-xs font-semibold tracking-widest uppercase text-[#FF6A00]/70 mb-5" style={{ fontFamily: MONO }}>Intelligence Outputs</h4>
            <div className="space-y-3">
              {[
                { label: 'Executive Alerts', desc: 'Critical items requiring immediate attention', color: '#EF4444' },
                { label: 'Revenue Warnings', desc: 'Pipeline risks, churn signals, deal stalls', color: '#F59E0B' },
                { label: 'Compliance Flags', desc: 'Regulatory gaps, missing documentation', color: '#8B5CF6' },
                { label: 'Cash Flow Risks', desc: 'Overdue invoices, margin compression', color: '#FF6A00' },
                { label: 'Auto-Generated Briefings', desc: 'Daily executive intelligence summaries', color: '#22C55E' },
              ].map((item) => (
                <div key={item.label} className="px-3 py-2.5 rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                    <span className="text-xs font-medium text-[#F4F7FA]" style={{ fontFamily: MONO }}>{item.label}</span>
                  </div>
                  <span className="text-[11px] text-[#9FB0C3]/60 ml-4" style={{ fontFamily: BODY }}>{item.desc}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-20" data-testid="platform-bottom-cta">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>Ready to see your business through a <span style={{ color: '#FF6A00' }}>single lens?</span></h2>
        <p className="text-base text-[#9FB0C3] mb-8" style={{ fontFamily: BODY }}>Connect your first platform in under 2 minutes.</p>
        <Link to="/register-supabase" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white" style={{ background: 'linear-gradient(135deg, #FF6A00, #E85D00)', fontFamily: HEADING, boxShadow: '0 8px 32px rgba(255,106,0,0.3)' }}>
          Start free trial <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  </WebsiteLayout>
);

export default PlatformPage;
