import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { supabase } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { FileText, DollarSign, Plug, Loader2, Download, Shield, AlertTriangle } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const ReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState([]);
  const [events, setEvents] = useState([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }
        const userId = session.user.id;

        // Check workspace integrations
        const { data: intData } = await supabase
          .from('workspace_integrations')
          .select('*')
          .eq('workspace_id', userId)
          .eq('status', 'connected');
        setIntegrations(intData || []);

        // Fetch governance events
        if (intData && intData.length > 0) {
          const { data: evData } = await supabase
            .from('governance_events')
            .select('*')
            .eq('workspace_id', userId)
            .order('signal_timestamp', { ascending: false })
            .limit(50);
          setEvents(evData || []);
        }
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  const hasAccounting = integrations.some(i => i.integration_type === 'accounting');
  const hasCRM = integrations.some(i => i.integration_type === 'crm');
  const hasAnyIntegration = integrations.length > 0;
  const hasEvents = events.length > 0;

  // Calculate confidence from real events only
  const avgConfidence = hasEvents
    ? Math.round((events.reduce((sum, e) => sum + (e.confidence_score || 0), 0) / events.length) * 100)
    : 0;

  const handleExportPDF = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await apiClient.post('/reports/generate-pdf', {
        integration_list: integrations.map(i => ({ type: i.integration_type, last_sync: i.last_sync_at })),
        events_count: events.length,
        avg_confidence: avgConfidence,
      });
      if (res.data?.pdf_url) {
        window.open(res.data.pdf_url, '_blank');
      }
    } catch {
      // PDF generation not yet available
    } finally {
      setGenerating(false);
    }
  }, [integrations, events, avgConfidence]);

  const renderFinancialNullState = () => (
    <Panel>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[#64748B] shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>Financial Snapshot Unavailable</h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            No accounting integration connected. Connect Xero, QuickBooks, or MYOB to generate verified financial reports.
            BIQc does not compute runway, margin, or budget metrics without verified accounting records.
          </p>
        </div>
      </div>
    </Panel>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: BODY }} data-testid="reports-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>Intelligence Reports</h1>
            <p className="text-sm text-[#9FB0C3]">Verified intelligence from connected data sources only.</p>
          </div>
          {hasEvents && (
            <button onClick={handleExportPDF} disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:bg-white/5 disabled:opacity-50"
              style={{ color: '#9FB0C3', border: '1px solid #243140', fontFamily: MONO }}
              data-testid="export-pdf-btn">
              <Download className="w-3.5 h-3.5" />
              {generating ? 'Generating...' : 'Export PDF'}
            </button>
          )}
        </div>

        {loading && (
          <Panel className="text-center py-8">
            <Loader2 className="w-6 h-6 text-[#FF6A00] mx-auto mb-3 animate-spin" />
            <p className="text-sm text-[#9FB0C3]">Loading report data...</p>
          </Panel>
        )}

        {!loading && !hasAnyIntegration && (
          <Panel className="text-center py-12">
            <Plug className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
            <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>No integrations connected.</p>
            <p className="text-xs text-[#64748B] mb-4 max-w-md mx-auto">
              Connect your CRM, accounting, and email integrations to generate verified intelligence reports.
              Reports contain only data from connected, verified sources.
            </p>
            <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6A00' }} data-testid="reports-connect-cta">
              <Plug className="w-4 h-4" /> Connect Integrations
            </a>
          </Panel>
        )}

        {!loading && hasAnyIntegration && (
          <>
            {/* Integration Status */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['crm', 'accounting', 'marketing', 'email'].map(type => {
                const connected = integrations.some(i => i.integration_type === type);
                const int = integrations.find(i => i.integration_type === type);
                return (
                  <Panel key={type}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: connected ? '#10B981' : '#64748B' }} />
                      <span className="text-[10px] text-[#9FB0C3] capitalize" style={{ fontFamily: MONO }}>{type}</span>
                    </div>
                    <span className="text-xs text-[#64748B]" style={{ fontFamily: MONO }}>
                      {connected ? `Synced ${int?.last_sync_at ? new Date(int.last_sync_at).toLocaleDateString('en-AU') : 'recently'}` : 'Not connected'}
                    </span>
                  </Panel>
                );
              })}
            </div>

            {/* Financial Snapshot — only with accounting */}
            {hasAccounting ? (
              <Panel>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: HEAD }}>Financial Snapshot</h3>
                <p className="text-xs text-[#9FB0C3]">Financial data from connected accounting integration. Metrics computed from verified transaction records.</p>
              </Panel>
            ) : renderFinancialNullState()}

            {/* Governance Events Summary */}
            {hasEvents ? (
              <Panel>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: HEAD }}>Signal Summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Total Events</span>
                    <span className="text-xl font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{events.length}</span>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Avg Confidence</span>
                    <span className="text-xl font-bold" style={{ fontFamily: MONO, color: avgConfidence > 70 ? '#10B981' : '#F59E0B' }}>{avgConfidence}%</span>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Data Sources</span>
                    <span className="text-xl font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{integrations.length}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {events.slice(0, 10).map(ev => (
                    <div key={ev.id} className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: '#0F1720' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ev.confidence_score >= 0.7 ? '#10B981' : '#F59E0B' }} />
                      <span className="text-xs text-[#9FB0C3] flex-1 truncate">{ev.event_type}</span>
                      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{ev.source_system}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : (
              <Panel className="text-center py-6">
                <Shield className="w-6 h-6 text-[#64748B] mx-auto mb-2" />
                <p className="text-xs text-[#64748B]">No verified signal events yet. Events will appear as integrations sync data.</p>
              </Panel>
            )}

            {/* Executive Memo — only if governance events exist */}
            {!hasEvents && (
              <Panel>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#64748B', fontFamily: MONO }}>Executive Memo</h3>
                <p className="text-xs text-[#64748B]">No verified signals available to generate executive memo. Memo requires governance events from connected integrations.</p>
              </Panel>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
