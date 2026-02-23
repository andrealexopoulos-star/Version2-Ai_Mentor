import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Activity, CheckCircle2, AlertTriangle, Database, RefreshCw, Clock, Wifi } from 'lucide-react';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const DataHealthPage = () => (
  <DashboardLayout>
    <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: INTER }} data-testid="data-health-page">
      <div>
        <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Data Health</h1>
        <p className="text-sm text-[#9FB0C3]">Integration sync status, data quality metrics, and system connectivity.</p>
      </div>

      {/* Overall Health */}
      <Panel>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <div>
              <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>All Systems Operational</h2>
              <p className="text-sm text-[#9FB0C3]">Last sync: 12 minutes ago</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium" style={{ background: '#FF6A0015', color: '#FF6A00', border: '1px solid #FF6A0030' }}>
            <RefreshCw className="w-3.5 h-3.5" />Force Sync
          </button>
        </div>
      </Panel>

      {/* Integration Status */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Connected Systems</h3>
        {[
          { name: 'Xero', type: 'Accounting', status: 'connected', lastSync: '12m ago', records: '1,247', health: 98, color: '#13B5EA' },
          { name: 'HubSpot', type: 'CRM', status: 'connected', lastSync: '8m ago', records: '892', health: 95, color: '#FF7A59' },
          { name: 'Outlook', type: 'Email', status: 'connected', lastSync: '3m ago', records: '3,451', health: 100, color: '#0078D4' },
          { name: 'Google Calendar', type: 'Calendar', status: 'connected', lastSync: '15m ago', records: '156', health: 100, color: '#4285F4' },
          { name: 'Slack', type: 'Communication', status: 'pending', lastSync: 'Never', records: '—', health: 0, color: '#4A154B' },
          { name: 'Jira', type: 'Project Management', status: 'pending', lastSync: 'Never', records: '—', health: 0, color: '#0052CC' },
        ].map((sys, i) => (
          <Panel key={i}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-sm" style={{ background: sys.color }}>
                {sys.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-[#F4F7FA]">{sys.name}</h4>
                  <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{sys.type}</span>
                </div>
                {sys.status === 'connected' && (
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-[11px] text-[#64748B]" style={{ fontFamily: MONO }}>{sys.records} records</span>
                    <span className="text-[11px] text-[#64748B]" style={{ fontFamily: MONO }}>Synced {sys.lastSync}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {sys.status === 'connected' ? (
                  <>
                    <div className="hidden md:block w-24">
                      <div className="h-1.5 rounded-full" style={{ background: '#10B98120' }}>
                        <div className="h-1.5 rounded-full" style={{ background: '#10B981', width: sys.health + '%' }} />
                      </div>
                      <span className="text-[10px] text-[#10B981]" style={{ fontFamily: MONO }}>{sys.health}% healthy</span>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                  </>
                ) : (
                  <button className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#FF6A0015', color: '#FF6A00', border: '1px solid #FF6A0030' }}>Connect</button>
                )}
              </div>
            </div>
          </Panel>
        ))}
      </div>

      {/* Data Quality */}
      <Panel>
        <h3 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: SORA }}>Data Quality Score</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Completeness', value: '94%', color: '#10B981' },
            { label: 'Accuracy', value: '97%', color: '#10B981' },
            { label: 'Freshness', value: '12m', color: '#10B981' },
            { label: 'Consistency', value: '91%', color: '#F59E0B' },
          ].map(m => (
            <div key={m.label} className="p-3 rounded-lg text-center" style={{ background: '#0F1720', border: '1px solid #243140' }}>
              <span className="text-xl font-bold block" style={{ fontFamily: MONO, color: m.color }}>{m.value}</span>
              <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{m.label}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  </DashboardLayout>
);

export default DataHealthPage;
