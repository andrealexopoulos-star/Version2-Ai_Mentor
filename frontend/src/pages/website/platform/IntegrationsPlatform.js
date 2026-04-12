import React, { useState } from 'react';
import PlatformLayout from '../../../components/website/PlatformLayout';
import { Link2, X, RefreshCw, Shield, Clock, ChevronRight } from 'lucide-react';
import { fontFamily } from '../../../design-system/tokens';


const integrations = [
  { name: 'Xero', category: 'Accounting', status: 'connected', lastSync: '12 min ago', data: ['Invoices', 'Transactions', 'Bank feeds', 'Aged receivables'], frequency: 'Every 15 minutes', permissions: ['Read invoices', 'Read bank transactions', 'Read contacts'] },
  { name: 'HubSpot', category: 'CRM', status: 'connected', lastSync: '8 min ago', data: ['Deals', 'Contacts', 'Companies', 'Pipeline'], frequency: 'Every 10 minutes', permissions: ['Read deals', 'Read contacts', 'Read pipeline'] },
  { name: 'Stripe', category: 'Payments', status: 'connected', lastSync: '3 min ago', data: ['Payments', 'Subscriptions', 'Invoices', 'Disputes'], frequency: 'Real-time webhooks', permissions: ['Read payments', 'Read subscriptions'] },
  { name: 'Google Workspace', category: 'Communication', status: 'connected', lastSync: '5 min ago', data: ['Email metadata', 'Calendar events', 'Response patterns'], frequency: 'Every 5 minutes', permissions: ['Read email metadata', 'Read calendar'] },
  { name: 'Slack', category: 'Communication', status: 'connected', lastSync: '1 min ago', data: ['Channel activity', 'Response times', 'Escalation patterns'], frequency: 'Real-time', permissions: ['Read messages metadata'] },
  { name: 'Deputy', category: 'HR & Payroll', status: 'connected', lastSync: '30 min ago', data: ['Timesheets', 'Rosters', 'Leave balances', 'Overtime'], frequency: 'Every 30 minutes', permissions: ['Read timesheets', 'Read rosters'] },
  { name: 'Salesforce', category: 'CRM', status: 'disconnected', lastSync: null, data: [], frequency: '-', permissions: [] },
  { name: 'MYOB', category: 'Accounting', status: 'disconnected', lastSync: null, data: [], frequency: '-', permissions: [] },
  { name: 'Shopify', category: 'Ecommerce', status: 'disconnected', lastSync: null, data: [], frequency: '-', permissions: [] },
];

const IntegrationsPlatform = () => {
  const [selected, setSelected] = useState(null);
  const connected = integrations.filter(i => i.status === 'connected');
  const disconnected = integrations.filter(i => i.status === 'disconnected');

  return (
    <PlatformLayout title="Integrations">
      <div className="flex gap-6 max-w-[1200px]">
        {/* Main grid */}
        <div className="flex-1 space-y-6">
          {/* Stats */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)' }}>
              <Link2 className="w-4 h-4 text-[#10B981]" />
              <span className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>Connected</span>
              <span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{connected.length}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)' }}>
              <Clock className="w-4 h-4 text-[#9FB0C3]" />
              <span className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>Last sync</span>
              <span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>1 min ago</span>
            </div>
          </div>

          {/* Connected */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-[#64748B] mb-3" style={{ fontFamily: fontFamily.mono }}>Connected Systems</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {connected.map(i => (
                <button key={i.name} onClick={() => setSelected(i)} className="flex items-center gap-3 px-4 py-3.5 rounded-lg text-left transition-all hover:border-[#E85D00]/30 group" style={{ background: '#0E1628', border: `1px solid ${selected?.name === i.name ? '#E85D00' + '50' : 'rgba(140,170,210,0.15)'}` }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#0F1720', border: '1px solid rgba(140,170,210,0.15)' }}>
                    <span className="text-sm font-bold text-[#9FB0C3] group-hover:text-[#E85D00] transition-colors" style={{ fontFamily: fontFamily.mono }}>{i.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[#EDF1F7] block" style={{ fontFamily: fontFamily.display }}>{i.name}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{i.lastSync}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#64748B] group-hover:text-[#E85D00] transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Available */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-[#64748B] mb-3" style={{ fontFamily: fontFamily.mono }}>Available to Connect</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {disconnected.map(i => (
                <div key={i.name} className="flex items-center gap-3 px-4 py-3.5 rounded-lg" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)', opacity: 0.6 }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#0F1720', border: '1px solid rgba(140,170,210,0.15)' }}>
                    <span className="text-sm font-bold text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{i.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[#9FB0C3]" style={{ fontFamily: fontFamily.display }}>{i.name}</span>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>{i.category}</span>
                  </div>
                  <button className="text-xs px-3 py-1.5 rounded-md font-medium" style={{ color: '#E85D00', background: '#E85D00' + '15', border: '1px solid #E85D0020', fontFamily: fontFamily.body }}>Connect</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Slide panel */}
        {selected && (
          <div className="hidden lg:block w-[340px] shrink-0 rounded-lg overflow-hidden" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)' }} data-testid="integration-detail-panel">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(140,170,210,0.15)' }}>
              <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-white/5 text-[#64748B]"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-5">
              <div>
                <span className="text-[10px] text-[#64748B] uppercase tracking-wider block mb-2" style={{ fontFamily: fontFamily.mono }}>Data Types Ingested</span>
                <div className="flex flex-wrap gap-1.5">
                  {selected.data.map(d => (
                    <span key={d} className="text-[11px] px-2 py-1 rounded" style={{ fontFamily: fontFamily.mono, color: '#9FB0C3', background: '#0F1720', border: '1px solid rgba(140,170,210,0.15)' }}>{d}</span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] uppercase tracking-wider block mb-1" style={{ fontFamily: fontFamily.mono }}>Sync Frequency</span>
                <span className="text-sm text-[#EDF1F7]" style={{ fontFamily: fontFamily.body }}>{selected.frequency}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] uppercase tracking-wider block mb-2" style={{ fontFamily: fontFamily.mono }}>Permission Scope</span>
                <div className="space-y-1">
                  {selected.permissions.map(p => (
                    <div key={p} className="flex items-center gap-2">
                      <Shield className="w-3 h-3 text-[#10B981]" />
                      <span className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-xs font-medium text-[#EF4444] mt-4" style={{ background: '#EF4444' + '10', border: '1px solid #EF444420', fontFamily: fontFamily.body }}>
                <X className="w-3.5 h-3.5" /> Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    </PlatformLayout>
  );
};

export default IntegrationsPlatform;
