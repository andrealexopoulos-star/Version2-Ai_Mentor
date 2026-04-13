import React, { useState } from 'react';
import PlatformLayout from '../../../components/website/PlatformLayout';
import { AlertTriangle, TrendingDown, TrendingUp, DollarSign, Shield, Activity, ArrowRight, Mail, MessageSquare, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { fontFamily } from '../../../design-system/tokens';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.15)' }}>{children}</div>
);

const HealthCapsule = ({ label, value, status, icon: Icon }) => {
  const colors = { good: '#10B981', warning: '#F59E0B', critical: '#E85D00' };
  const c = colors[status] || colors.good;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid rgba(140,170,210,0.15)' }} data-testid={`health-${label.toLowerCase().replace(/\s/g,'-')}`}>
      <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: c + '15' }}>
        <Icon className="w-4 h-4" style={{ color: c }} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>{label}</span>
        <span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{value}</span>
      </div>
      <div className="w-2 h-2 rounded-full" style={{ background: c, boxShadow: status !== 'good' ? `0 0 8px ${c}50` : 'none' }} />
    </div>
  );
};

const AttentionCard = ({ severity, title, impact, action, actions }) => {
  const [open, setOpen] = useState(false);
  const sevColors = { critical: '#E85D00', moderate: '#F59E0B', info: '#3B82F6' };
  const c = sevColors[severity] || sevColors.info;
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--surface, #0E1628)', border: `1px solid ${c}30` }} data-testid="attention-card">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-5 py-4 text-left">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c, boxShadow: `0 0 8px ${c}50` }} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-[#EDF1F7] block" style={{ fontFamily: fontFamily.display }}>{title}</span>
          <span className="text-xs text-[#8FA0B8] mt-0.5 block" style={{ fontFamily: fontFamily.body }}>{impact}</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-wider shrink-0" style={{ fontFamily: fontFamily.mono, color: c, background: c + '15' }}>{severity}</span>
        {open ? <ChevronUp className="w-4 h-4 text-[#64748B] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#64748B] shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(140,170,210,0.15)' }}>
          <p className="text-sm text-[#8FA0B8] pt-3" style={{ fontFamily: fontFamily.body }}>{action}</p>
          <div className="flex flex-wrap gap-2">
            {actions?.includes('email') && <button onClick={() => window.location.assign('/login-supabase')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors" style={{ background: '#3B82F6' + '15', color: '#3B82F6', border: '1px solid #3B82F6' + '30', fontFamily: fontFamily.body }}><Mail className="w-3.5 h-3.5" />Auto-Email</button>}
            {actions?.includes('sms') && <button onClick={() => window.location.assign('/login-supabase')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors" style={{ background: '#10B981' + '15', color: '#10B981', border: '1px solid #10B981' + '30', fontFamily: fontFamily.body }}><MessageSquare className="w-3.5 h-3.5" />Quick-SMS</button>}
            {actions?.includes('handoff') && <button onClick={() => window.location.assign('/login-supabase')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors" style={{ background: '#E85D00' + '15', color: '#E85D00', border: '1px solid #E85D00' + '30', fontFamily: fontFamily.body }}><Users className="w-3.5 h-3.5" />Hand Off</button>}
          </div>
        </div>
      )}
    </div>
  );
};

const MiniChart = ({ data, color }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 80}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" className="w-full h-12" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const ExecOverview = () => (
  <PlatformLayout title="BIQc Insights">
    <div className="space-y-6 max-w-[1200px]">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>Good afternoon, Andre.</h2>
        <p className="text-sm text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>Last intelligence update: 12 minutes ago</p>
      </div>

      {/* Health Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="health-strip">
        <HealthCapsule label="Business Health" value="74%" status="warning" icon={Activity} />
        <HealthCapsule label="Cash Risk" value="Moderate" status="warning" icon={DollarSign} />
        <HealthCapsule label="Revenue Stability" value="Stable" status="good" icon={TrendingUp} />
        <HealthCapsule label="Operational Drift" value="2 SLA breaches" status="critical" icon={AlertTriangle} />
        <HealthCapsule label="Compliance" value="96%" status="good" icon={Shield} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: What Needs Attention */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>What Needs Attention</h3>
            <span className="text-[10px] px-2 py-0.5 rounded" style={{ fontFamily: fontFamily.mono, color: '#E85D00', background: '#E85D00' + '15' }}>5 items</span>
          </div>
          <AttentionCard severity="critical" title="Invoice #1847 — $3,200 overdue 12 days" impact="Cash flow impact. Client #47 has history of late payment." action="AI has drafted a firm but polite payment reminder. Recommended follow-up in 3 days if no response." actions={['email', 'sms', 'handoff']} />
          <AttentionCard severity="critical" title="3 enterprise deals stalled at proposal stage" impact="$45K revenue gap projected for Q2 if unresolved." action="Close rate compression detected. Pricing objection common across all 3 deals. Consider revised proposals." actions={['email', 'handoff']} />
          <AttentionCard severity="moderate" title="Subcontractor costs up 12% in 45 days" impact="Margin compression risk on Service B." action="Renegotiate rates or source alternative suppliers within 30 days." actions={['handoff']} />
          <AttentionCard severity="moderate" title="3 new leads not contacted in 24 hours" impact="SOP requires contact within 4 hours." action="AI can send personalised intro emails to all 3, logged to CRM." actions={['email']} />
          <AttentionCard severity="info" title="BAS Q3 due in 18 days" impact="No action required now. All documents prepared." action="Review and submit before deadline. Current compliance status: Ready." actions={[]} />
        </div>

        {/* Right: Financial Snapshot + Pulse */}
        <div className="space-y-4">
          {/* Financial Snapshot */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: fontFamily.display }}>Financial Snapshot</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Cash Trend (30d)</span>
                  <span className="text-xs text-[#10B981]" style={{ fontFamily: fontFamily.mono }}>+4.2%</span>
                </div>
                <MiniChart data={[42, 45, 43, 48, 46, 50, 52, 49, 54, 56, 53, 58]} color="#10B981" />
              </div>
              <div style={{ borderTop: '1px solid rgba(140,170,210,0.15)', paddingTop: 12 }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Receivables Ageing</span>
                  <span className="text-xs text-[#E85D00]" style={{ fontFamily: fontFamily.mono }}>$12,400</span>
                </div>
                <div className="flex gap-1 mt-2">
                  {[{ label: '0-30d', val: 60, c: '#10B981' }, { label: '31-60d', val: 25, c: '#F59E0B' }, { label: '60+', val: 15, c: '#E85D00' }].map(s => (
                    <div key={s.label} className="flex-1">
                      <div className="h-2 rounded-full" style={{ background: s.c + '30' }}>
                        <div className="h-2 rounded-full" style={{ background: s.c, width: s.val + '%' }} />
                      </div>
                      <span className="text-[10px] text-[#64748B] mt-1 block" style={{ fontFamily: fontFamily.mono }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(140,170,210,0.15)', paddingTop: 12 }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Margin Variance</span>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 text-[#E85D00]" />
                    <span className="text-xs text-[#E85D00]" style={{ fontFamily: fontFamily.mono }}>-3.1%</span>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* Intelligence Pulse */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: fontFamily.display }}>Intelligence Pulse</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Systems Connected', value: '6', color: '#10B981' },
                { label: 'Signals Monitored', value: '1,247', color: '#3B82F6' },
                { label: 'Alerts (30d)', value: '23', color: '#E85D00' },
                { label: 'Issues Prevented', value: '8', color: '#10B981' },
              ].map(m => (
                <div key={m.label} className="p-3 rounded-md" style={{ background: '#0F1720', border: '1px solid rgba(140,170,210,0.15)' }}>
                  <span className="text-lg font-bold block" style={{ fontFamily: fontFamily.mono, color: m.color }}>{m.value}</span>
                  <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{m.label}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Runway */}
          <Panel>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Cash Runway</span>
              <span className="text-lg font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>4.2 <span className="text-xs text-[#64748B]">months</span></span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  </PlatformLayout>
);

export default ExecOverview;
