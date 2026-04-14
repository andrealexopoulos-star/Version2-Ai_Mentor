import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { supabase } from '../context/SupabaseAuthContext';
import { Plug, Loader2, Shield, Download, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
// Design tokens now referenced via CSS custom properties


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
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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
    let result = events;
    if (categoryFilter !== 'all') {
      result = result.filter(ev => (ev.event_category || ev.source_system || '').toLowerCase().includes(categoryFilter));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(ev =>
        (ev.event_type || '').toLowerCase().includes(q) ||
        (ev.source_system || '').toLowerCase().includes(q) ||
        (ev.signal_reference || '').toLowerCase().includes(q) ||
        (ev.event_category || '').toLowerCase().includes(q)
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter(ev => new Date(ev.signal_timestamp) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(ev => new Date(ev.signal_timestamp) <= to);
    }
    return result;
  }, [events, categoryFilter, searchQuery, dateFrom, dateTo]);

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
      <Plug className="w-8 h-8 text-[var(--ink-muted)] mx-auto mb-3" />
      <p className="text-sm font-semibold text-[var(--ink-display)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>No governance events recorded yet.</p>
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
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: 'var(--font-ui)' }} data-testid="audit-log-page">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-medium mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 28, letterSpacing: 'var(--ls-display)', lineHeight: 1.05 }}>Audit Log</h1>
            <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>Verified events from connected integrations. No AI-generated entries.</p>
          </div>
          {events.length > 0 && (
            <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }} data-testid="audit-export-csv">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
        </div>

        {/* KPI stat header row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Events', value: loading ? '\u2014' : events.length },
            { label: 'Critical', value: loading ? '\u2014' : events.filter(ev => ev.confidence_score != null && ev.confidence_score < 0.5).length },
            { label: 'This Week', value: loading ? '\u2014' : events.filter(ev => { const d = new Date(ev.signal_timestamp); return (Date.now() - d.getTime()) < 7 * 86400000; }).length },
            { label: 'Users Active', value: loading ? '\u2014' : new Set(events.map(ev => ev.source_system).filter(Boolean)).size },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--ink-display)', display: 'block', lineHeight: 1 }}>{value}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-secondary)', display: 'block', marginTop: 8 }}>{label}</span>
            </div>
          ))}
        </div>

        {loading && (
          <Panel className="text-center py-8">
            <Loader2 className="w-6 h-6 text-[#E85D00] mx-auto mb-3 animate-spin" />
            <p className="text-sm text-[var(--ink-secondary)]">Loading audit trail...</p>
          </Panel>
        )}

        {!loading && integrations.length === 0 && renderNullState()}

        {!loading && integrations.length > 0 && events.length === 0 && (
          <Panel className="text-center py-8">
            <Shield className="w-8 h-8 text-[#10B981] mx-auto mb-3" />
            <p className="text-sm text-[var(--ink-display)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>No governance events recorded.</p>
            <p className="text-xs text-[var(--ink-muted)]">Events will appear as BIQc processes verified signals from your {integrations.length} connected integration{integrations.length > 1 ? 's' : ''}.</p>
          </Panel>
        )}

        {!loading && events.length > 0 && (
          <>
            {/* Filter + Search + Date toolbar */}
            <div className="flex items-center gap-3 flex-wrap" data-testid="audit-category-filters">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => { setCategoryFilter(cat); setPage(1); }}
                  className="px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all capitalize"
                  style={{
                    background: categoryFilter === cat ? 'var(--surface-sunken)' : 'transparent',
                    color: categoryFilter === cat ? 'var(--ink-display)' : 'var(--ink-secondary)',
                    border: categoryFilter === cat ? '1px solid rgba(140,170,210,0.2)' : '1px solid rgba(140,170,210,0.08)',
                    fontFamily: 'var(--font-mono)',
                  }}
                  data-testid={`audit-filter-${cat}`}>
                  {cat}
                </button>
              ))}
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Filter by actor, action, resource..."
                className="flex-1 min-w-[200px] px-3 py-2 rounded-lg text-sm audit-toolbar-search"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid rgba(140,170,210,0.12)',
                  color: 'var(--ink-display)',
                  fontFamily: 'var(--font-ui)',
                  outline: 'none',
                }}
                data-testid="audit-search-input"
              />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ink-muted)' }} />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                    className="px-2 py-1.5 rounded-lg text-xs audit-date-input"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid rgba(140,170,210,0.12)',
                      color: 'var(--ink-display)',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                      width: 130,
                    }}
                    data-testid="audit-date-from"
                  />
                  <span className="text-xs" style={{ color: '#5C6E82' }}>to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => { setDateTo(e.target.value); setPage(1); }}
                    className="px-2 py-1.5 rounded-lg text-xs audit-date-input"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid rgba(140,170,210,0.12)',
                      color: 'var(--ink-display)',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                      width: 130,
                    }}
                    data-testid="audit-date-to"
                  />
                </div>
              </div>
              <style>{`
                .audit-toolbar-search::placeholder { color: #5C6E82 !important; }
                .audit-date-input::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
              `}</style>
            </div>

            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#10B981', background: '#10B98115', fontFamily: 'var(--font-mono)' }}>{filteredEvents.length} verified events</span>
              <span className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>{integrations.length} connected source{integrations.length > 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-2">
              {pagedEvents.map((ev) => {
                const color = ev.confidence_score >= 0.8 ? '#10B981' : ev.confidence_score >= 0.5 ? '#F59E0B' : '#EF4444';
                return (
                  <div key={ev.id} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }} data-testid={`audit-event-${ev.id}`}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[var(--ink-display)] block truncate" style={{ fontFamily: 'var(--font-ui)' }}>{ev.event_type}</span>
                      {ev.signal_reference && <span className="text-[10px] text-[var(--ink-muted)] block" style={{ fontFamily: 'var(--font-mono)' }}>ref: {ev.signal_reference}</span>}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded shrink-0" style={{ color: 'var(--biqc-text-2)', background: 'rgba(140,170,210,0.15)', fontFamily: 'var(--font-mono)' }}>{ev.source_system}</span>
                    {ev.confidence_score != null && (
                      <span className="text-[10px] shrink-0" style={{ color, fontFamily: 'var(--font-mono)' }}>{Math.round(ev.confidence_score * 100)}%</span>
                    )}
                    <span className="text-[10px] text-[var(--ink-muted)] shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
                      {new Date(ev.signal_timestamp).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3" data-testid="audit-pagination">
                <span className="text-[11px] text-[var(--ink-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                  {(page - 1) * PAGE_SIZE + 1}--{Math.min(page * PAGE_SIZE, filteredEvents.length)} of {filteredEvents.length}
                </span>
                <div className="flex gap-1">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 rounded text-xs disabled:opacity-30" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', color: 'var(--ink-display)' }}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 py-1 text-xs" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-mono)' }}>{page} / {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 rounded text-xs disabled:opacity-30" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', color: 'var(--ink-display)' }}>
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
