import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { supabase } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { FileText, DollarSign, Plug, Download, Shield, AlertTriangle } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
);

const CALIB_REPORT_KEY = 'biqc_calibration_report_date';
const SCAN_REPORT_KEY = 'biqc_scan_report_date';
const REPORT_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

const ForensicReportCard = () => {
  const calibDate = (() => { try { return parseInt(localStorage.getItem(CALIB_REPORT_KEY) || '0', 10); } catch { return 0; } })();
  const scanDate = (() => { try { return parseInt(localStorage.getItem(SCAN_REPORT_KEY) || '0', 10); } catch { return 0; } })();

  const calibNext = Math.max(0, REPORT_CYCLE_MS - (Date.now() - calibDate));
  const scanNext = Math.max(0, REPORT_CYCLE_MS - (Date.now() - scanDate));
  const calibDays = Math.ceil(calibNext / (24 * 60 * 60 * 1000));
  const scanDays = Math.ceil(scanNext / (24 * 60 * 60 * 1000));
  const calibNextDate = new Date(Date.now() + calibNext).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  const scanNextDate = new Date(Date.now() + scanNext).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Panel>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-[#FF6A00]" />
        <h3 className="text-base font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Forensic Intelligence Reports</h3>
        <span className="text-[9px] px-2 py-0.5 rounded-full ml-auto" style={{ background: '#FF6A0015', color: '#FF6A00', fontFamily: fontFamily.mono }}>FREE TIER: 1/30 DAYS</span>
      </div>
      <p className="text-xs text-[#64748B] mb-4" style={{ fontFamily: fontFamily.body }}>
        Downloadable Board-ready Executive Summary reports. Free tier: one scan per 30 days. Upgrade for unlimited.
      </p>
      <div className="space-y-3">
        {/* Forensic Calibration Report */}
        <div className="rounded-xl p-4" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Forensic Calibration Report</span>
              </div>
              <p className="text-xs text-[#64748B]">Digital footprint analysis, identity verification, and strategic positioning assessment.</p>
              {calibDate > 0 && (
                <p className="text-[10px] mt-1.5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
                  Last generated: {new Date(calibDate).toLocaleDateString('en-AU')} · Next available: {calibDays > 0 ? calibNextDate : 'Now'}
                </p>
              )}
            </div>
            {calibDate > 0 ? (
              <a href="/market/calibration" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0" style={{ background: '#7C3AED', color: 'white' }}>
                <Download className="w-3 h-3" /> Download PDF
              </a>
            ) : (
              <a href="/calibration" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0" style={{ background: '#7C3AED15', color: '#7C3AED', border: '1px solid #7C3AED30' }}>
                Run Calibration
              </a>
            )}
          </div>
        </div>

        {/* Market Exposure Scan Report */}
        <div className="rounded-xl p-4" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Market Exposure Scan Report</span>
              </div>
              <p className="text-xs text-[#64748B]">Structural competitive exposure analysis — gaps, vulnerabilities, and market positioning risks.</p>
              {scanDate > 0 && (
                <p className="text-[10px] mt-1.5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
                  Last generated: {new Date(scanDate).toLocaleDateString('en-AU')} · Next available: {scanDays > 0 ? scanNextDate : 'Now'}
                </p>
              )}
            </div>
            {scanDate > 0 ? (
              <a href="/exposure-scan" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0" style={{ background: '#3B82F6', color: 'white' }}>
                <Download className="w-3 h-3" /> Download PDF
              </a>
            ) : (
              <a href="/exposure-scan" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0" style={{ background: '#3B82F615', color: '#3B82F6', border: '1px solid #3B82F630' }}>
                Run Scan
              </a>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
};

const ReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [events, setEvents] = useState([]);
  const [generating, setGenerating] = useState(false);

  const loadReportsData = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      const userId = session.user.id;

      const { data: intData, error: intErr } = await supabase
        .from('workspace_integrations')
        .select('*')
        .eq('workspace_id', userId)
        .eq('status', 'connected');
      if (intErr) throw intErr;
      setIntegrations(intData || []);

      if (intData && intData.length > 0) {
        const { data: evData, error: evErr } = await supabase
          .from('governance_events')
          .select('*')
          .eq('workspace_id', userId)
          .order('signal_timestamp', { ascending: false })
          .limit(50);
        if (evErr) throw evErr;
        setEvents(evData || []);
      } else {
        setEvents([]);
      }
    } catch (e) {
      setLoadError(e?.message || 'Unable to load reports data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

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
          <h3 className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Financial Snapshot Unavailable</h3>
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
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: fontFamily.body }} data-testid="reports-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Intelligence Reports</h1>
            <p className="text-sm text-[#9FB0C3]">Verified intelligence from connected data sources only.</p>
          </div>
          {hasEvents && (
            <button onClick={handleExportPDF} disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:bg-white/5 disabled:opacity-50"
              style={{ color: 'var(--biqc-text-2)', border: '1px solid var(--biqc-border)', fontFamily: fontFamily.mono }}
              data-testid="export-pdf-btn">
              <Download className="w-3.5 h-3.5" />
              {generating ? 'Generating...' : 'Export PDF'}
            </button>
          )}
        </div>

        {/* ── FORENSIC REPORTS SECTION ── */}
        <ForensicReportCard />

        {loading && <PageLoadingState message="Loading intelligence reports..." />}

        {!loading && loadError && (
          <PageErrorState error={loadError} onRetry={loadReportsData} moduleName="Reports" />
        )}

        {!loading && !loadError && !hasAnyIntegration && (
          <Panel className="text-center py-12">
            <Plug className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
            <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>No integrations connected.</p>
            <p className="text-xs text-[#64748B] mb-4 max-w-md mx-auto">
              Connect your CRM, accounting, and email integrations to generate verified intelligence reports.
              Reports contain only data from connected, verified sources.
            </p>
            <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6A00' }} data-testid="reports-connect-cta">
              <Plug className="w-4 h-4" /> Connect Integrations
            </a>
          </Panel>
        )}

        {!loading && !loadError && hasAnyIntegration && (
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
                      <span className="text-[10px] text-[#9FB0C3] capitalize" style={{ fontFamily: fontFamily.mono }}>{type}</span>
                    </div>
                    <span className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                      {connected ? `Synced ${int?.last_sync_at ? new Date(int.last_sync_at).toLocaleDateString('en-AU') : 'recently'}` : 'Not connected'}
                    </span>
                  </Panel>
                );
              })}
            </div>

            {/* Financial Snapshot — only with accounting */}
            {hasAccounting ? (
              <Panel>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: fontFamily.display }}>Financial Snapshot</h3>
                <p className="text-xs text-[#9FB0C3]">Financial data from connected accounting integration. Metrics computed from verified transaction records.</p>
              </Panel>
            ) : renderFinancialNullState()}

            {/* Governance Events Summary */}
            {hasEvents ? (
              <Panel>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: fontFamily.display }}>Signal Summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Total Events</span>
                    <span className="text-xl font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>{events.length}</span>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Avg Confidence</span>
                    <span className="text-xl font-bold" style={{ fontFamily: fontFamily.mono, color: avgConfidence > 70 ? '#10B981' : '#F59E0B' }}>{avgConfidence}%</span>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Data Sources</span>
                    <span className="text-xl font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>{integrations.length}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {events.slice(0, 10).map(ev => (
                    <div key={ev.id} className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: 'var(--biqc-bg)' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ev.confidence_score >= 0.7 ? '#10B981' : '#F59E0B' }} />
                      <span className="text-xs text-[#9FB0C3] flex-1 truncate">{ev.event_type}</span>
                      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{ev.source_system}</span>
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
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Executive Memo</h3>
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
