import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useSnapshot } from '../hooks/useSnapshot';
import { CognitiveMesh } from '../components/LoadingSystems';
import { ClipboardList, User, RefreshCw } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const AuditLogPage = () => {
  const { cognitive, loading, sources } = useSnapshot();
  const c = cognitive || {};
  const rq = c.resolution_queue || [];
  const inv = c.inevitabilities || [];

  // Build audit log from cognitive events
  const events = [
    ...rq.map(r => ({ type: 'resolution', title: r.title, severity: r.severity, source: 'AI Detection' })),
    ...inv.map(r => ({ type: 'inevitability', title: r.signal || r.domain, severity: r.intensity === 'imminent' ? 'high' : 'medium', source: r.domain })),
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: BODY }} data-testid="audit-log-page">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>Audit Log</h1>
          <p className="text-sm text-[#9FB0C3]">Record of all AI-detected events, actions, and system decisions.</p>
        </div>

        {loading && <CognitiveMesh message="Loading audit trail..." />}

        {!loading && (
          <>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#10B981', background: '#10B98115', fontFamily: MONO }}>{events.length} events</span>
              {sources?.length > 0 && <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{sources.length} data sources</span>}
            </div>

            {events.length > 0 ? (
              <div className="space-y-2">
                {events.map((ev, i) => {
                  const color = ev.severity === 'high' ? '#EF4444' : ev.severity === 'medium' ? '#F59E0B' : '#10B981';
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-sm text-[#F4F7FA] flex-1" style={{ fontFamily: BODY }}>{ev.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded shrink-0" style={{ color: '#64748B', background: '#24314050', fontFamily: MONO }}>{ev.type}</span>
                      <span className="text-[10px] text-[#64748B] shrink-0" style={{ fontFamily: MONO }}>{ev.source}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Panel className="text-center py-8">
                <ClipboardList className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                <p className="text-sm text-[#64748B]">No audit events recorded yet. Events will appear as BIQc detects signals from your connected integrations.</p>
              </Panel>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AuditLogPage;
