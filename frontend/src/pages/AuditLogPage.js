import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { ClipboardList, User, Settings, Shield, Zap, LogIn, FileText, RefreshCw } from 'lucide-react';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const AuditLogPage = () => (
  <DashboardLayout>
    <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: INTER }} data-testid="audit-log-page">
      <div>
        <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Audit Log</h1>
        <p className="text-sm text-[#9FB0C3]">Complete activity trail across your BIQc platform.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Authentication', 'AI Actions', 'Integrations', 'Settings', 'Data'].map(f => (
          <button key={f} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: f === 'All' ? '#FF6A00' : '#141C26', color: f === 'All' ? 'white' : '#9FB0C3', border: `1px solid ${f === 'All' ? '#FF6A00' : '#243140'}`, fontFamily: MONO }}>
            {f}
          </button>
        ))}
      </div>

      {/* Log Entries */}
      <div className="space-y-1">
        {[
          { time: '14:23', date: 'Today', action: 'AI sent payment reminder email', actor: 'BIQc AI', type: 'ai', detail: 'Invoice #1847 — $3,200 reminder sent to client47@example.com', icon: Zap },
          { time: '14:18', date: 'Today', action: 'Intelligence snapshot generated', actor: 'System', type: 'system', detail: 'Full cognitive analysis completed in 4.2 seconds. 6 data sources processed.', icon: RefreshCw },
          { time: '13:45', date: 'Today', action: 'User login', actor: 'Andre', type: 'auth', detail: 'Authenticated via Google OAuth. Session started.', icon: LogIn },
          { time: '12:30', date: 'Today', action: 'Xero sync completed', actor: 'System', type: 'integration', detail: '47 new transactions synced. 3 invoices updated.', icon: RefreshCw },
          { time: '11:15', date: 'Today', action: 'HubSpot sync completed', actor: 'System', type: 'integration', detail: '12 contacts updated. 2 new deals detected.', icon: RefreshCw },
          { time: '09:00', date: 'Today', action: 'SOP compliance check executed', actor: 'Automation', type: 'ai', detail: 'Daily compliance scan: 87% overall. 1 new deviation detected.', icon: Shield },
          { time: '08:30', date: 'Today', action: 'Lead follow-up emails queued', actor: 'BIQc AI', type: 'ai', detail: '3 personalised intro emails drafted and queued for review.', icon: Zap },
          { time: '23:00', date: 'Yesterday', action: 'Nightly data aggregation', actor: 'System', type: 'system', detail: 'All integration data consolidated. Weekly metrics updated.', icon: Settings },
          { time: '18:45', date: 'Yesterday', action: 'User updated business profile', actor: 'Andre', type: 'settings', detail: 'Revenue targets updated. Industry classification confirmed.', icon: User },
          { time: '16:20', date: 'Yesterday', action: 'Risk assessment updated', actor: 'BIQc AI', type: 'ai', detail: 'Subcontractor cost increase detected. Risk level elevated to Moderate.', icon: Shield },
        ].map((entry, i) => {
          const typeColors = { ai: '#FF6A00', system: '#3B82F6', auth: '#10B981', integration: '#7C3AED', settings: '#64748B' };
          const color = typeColors[entry.type] || '#64748B';
          return (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid #24314030' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + '15' }}>
                <entry.icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm text-[#F4F7FA]">{entry.action}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color, background: color + '15', fontFamily: MONO }}>{entry.type}</span>
                </div>
                <p className="text-[11px] text-[#64748B]">{entry.detail}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-[#9FB0C3] block" style={{ fontFamily: MONO }}>{entry.time}</span>
                <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{entry.date}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </DashboardLayout>
);

export default AuditLogPage;
