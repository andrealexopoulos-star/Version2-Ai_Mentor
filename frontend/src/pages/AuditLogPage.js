import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { supabase } from '../context/SupabaseAuthContext';
import { ClipboardList, Plug, Loader2, Shield, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
);

const CATEGORIES = ['all', 'auth', 'data', 'security', 'config', 'integration', 'ai'];
const PAGE_SIZE = 12;

const AuditLogPage = () => {
  const [events, setEvents] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }
        const userId = session.user.id;

        // Query workspace_integrations for connected integrations
        const { data: intData, error: intErr } = await supabase
          .from('workspace_integrations')
          .select('*')
          .eq('workspace_id', userId)
          .eq('status', 'connected');

        if (intErr) {
          // Table may not exist yet — show null state
          console.warn('[AuditLog] workspace_integrations query failed:', intErr.message);
          setIntegrations([]);
        } else {
          setIntegrations(intData || []);
        }

        // Only fetch governance events if integrations exist
        if (intData && intData.length > 0) {
          const { data: evData, error: evErr } = await supabase
            .from('governance_events')
            .select('*')
            .eq('workspace_id', userId)
            .order('signal_timestamp', { ascending: false })
            .limit(100);

          if (evErr) {
            console.warn('[AuditLog] governance_events query failed:', evErr.message);
            setEvents([]);
          } else {
            setEvents(evData || []);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const filteredEvents = useMemo(() => {
    if (categoryFilter === 'all') return events;
    return events.filter(ev => (ev.event_category || ev.source_system || '').toLowerCase().includes(categoryFilter));
  }, [events, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const pagedEvents = filteredEvents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportCSV = () => {
    if (filteredEvents.length === 0) return;
    const header = 'timestamp,event_type,source,confidence,reference\n';
    const rows = filteredEvents.map(ev =>
      `"${ev.signal_timestamp}","${ev.event_type}","${ev.source_system}","${ev.confidence_score ?? ''}","${ev.signal_reference ?? ''}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const renderNullState = () => (
    <Panel className="text-center py-12">
      <Plug className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
      <p className="text-sm font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>No governance events recorded yet.</p>
      <p className="text-xs mb-4 max-w-md mx-auto" style={{ color: 'var(--biqc-text-2)' }}>
        The audit log records every verified intelligence event from your connected systems — deal changes, invoice movements, compliance flags. Connect CRM or accounting to start building your governance trail.
      </p>
      <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#E85D00' }} data-testid="audit-connect-cta">
        <Plug className="w-4 h-4" /> Connect Integrations
      </a>
    </Panel>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: fontFamily.body }} data-testid="audit-log-page">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-medium mb-1" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.05 }}>Audit Log</h1>
            <p className="text-sm" style={{ color: '#8FA0B8' }}>Verified events from connected integrations. No AI-generated entries.</p>
          </div>
          {events.length > 0 && (
            <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', color: '#EDF1F7', fontFamily: fontFamily.body }} data-testid="audit-export-csv">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
        </div>

        {loading && (
          <Panel className="text-center py-8">
            <Loader2 className="w-6 h-6 text-[#E85D00] mx-auto mb-3 animate-spin" />
            <p className="text-sm text-[#8FA0B8]">Loading audit trail...</p>
          </Panel>
        )}

        {!loading && integrations.length === 0 && renderNullState()}

        {!loading && integrations.length > 0 && events.length === 0 && (
          <Panel className="text-center py-8">
            <Shield className="w-8 h-8 text-[#10B981] mx-auto mb-3" />
            <p className="text-sm text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>No governance events recorded.</p>
            <p className="text-xs text-[#64748B]">Events will appear as BIQc processes verified signals from your {integrations.length} connected integration{integrations.length > 1 ? 's' : ''}.</p>
          </Panel>
        )}

        {!loading && events.length > 0 && (
          <>
            {/* Category filter bar */}
            <div className="flex flex-wrap items-center gap-1" data-testid="audit-category-filters">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => { setCategoryFilter(cat); setPage(1); }}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all capitalize"
                  style={{ background: categoryFilter === cat ? '#1E293B' : 'var(--biqc-bg-card)', color: categoryFilter === cat ? '#fff' : '#708499', border: `1px solid ${categoryFilter === cat ? '#1E293B' : 'var(--biqc-border)'}`, fontFamily: fontFamily.mono }}
                  data-testid={`audit-filter-${cat}`}>
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#10B981', background: '#10B98115', fontFamily: fontFamily.mono }}>{filteredEvents.length} verified events</span>
              <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{integrations.length} connected source{integrations.length > 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-2">
              {pagedEvents.map((ev) => {
                const color = ev.confidence_score >= 0.8 ? '#10B981' : ev.confidence_score >= 0.5 ? '#F59E0B' : '#EF4444';
                return (
                  <div key={ev.id} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }} data-testid={`audit-event-${ev.id}`}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[#EDF1F7] block truncate" style={{ fontFamily: fontFamily.body }}>{ev.event_type}</span>
                      {ev.signal_reference && <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>ref: {ev.signal_reference}</span>}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded shrink-0" style={{ color: 'var(--biqc-text-2)', background: 'rgba(140,170,210,0.15)', fontFamily: fontFamily.mono }}>{ev.source_system}</span>
                    {ev.confidence_score != null && (
                      <span className="text-[10px] shrink-0" style={{ color, fontFamily: fontFamily.mono }}>{Math.round(ev.confidence_score * 100)}%</span>
                    )}
                    <span className="text-[10px] text-[#64748B] shrink-0" style={{ fontFamily: fontFamily.mono }}>
                      {new Date(ev.signal_timestamp).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3" data-testid="audit-pagination">
                <span className="text-[11px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                  {(page - 1) * PAGE_SIZE + 1}--{Math.min(page * PAGE_SIZE, filteredEvents.length)} of {filteredEvents.length}
                </span>
                <div className="flex gap-1">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 rounded text-xs disabled:opacity-30" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', color: '#EDF1F7' }}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 py-1 text-xs" style={{ color: '#EDF1F7', fontFamily: fontFamily.mono }}>{page} / {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 rounded text-xs disabled:opacity-30" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', color: '#EDF1F7' }}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AuditLogPage;
