import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { supabase, useSupabaseAuth } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { FileText, DollarSign, Plug, Download, Shield, AlertTriangle, Clock } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';
import { EVENTS, trackActivationStep, trackOnceForUser } from '../lib/analytics';
const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', resize: 'horizontal', overflow: 'auto', minWidth: '280px', maxWidth: '100%' }}>{children}</div>
);

const CALIB_REPORT_KEY = 'biqc_calibration_report_date';
const SCAN_REPORT_KEY = 'biqc_scan_report_date';
const ADVISORY_MEMO_KEY = 'biqc_advisory_memos';
const REPORT_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;
const parseJsonSafe = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const formatDuration = (seconds = 0) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

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
        <Shield className="w-4 h-4 text-[#E85D00]" />
        <h3 className="text-base font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Forensic Intelligence Reports</h3>
        <span className="text-[9px] px-2 py-0.5 rounded-full ml-auto" style={{ background: '#E85D0015', color: '#E85D00', fontFamily: fontFamily.mono }}>FREE TIER: 1/30 DAYS</span>
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
                <span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Forensic Calibration Report</span>
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
                <span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Market Exposure Scan Report</span>
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
  const { user } = useSupabaseAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [events, setEvents] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [advisoryMemos, setAdvisoryMemos] = useState([]);
  const [marketInsightsReport, setMarketInsightsReport] = useState(null);

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

      try {
        const profileRes = await apiClient.get('/business-profile');
        const profile = profileRes?.data || {};
        const bundle = parseJsonSafe(profile?.competitor_scan_result, null);
        setMarketInsightsReport(bundle && typeof bundle === 'object' ? bundle : null);
      } catch {
        setMarketInsightsReport(null);
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

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(ADVISORY_MEMO_KEY) || '[]');
      setAdvisoryMemos(Array.isArray(stored) ? stored : []);
    } catch {
      setAdvisoryMemos([]);
    }
  }, []);

  useEffect(() => {
    if (loading || loadError) return;
    trackOnceForUser(EVENTS.ACTIVATION_FIRST_REPORT, user?.id, { has_integrations: integrations.length > 0 });
    trackActivationStep('first_report_view', { has_integrations: integrations.length > 0 });
  }, [loading, loadError, integrations.length, user?.id]);

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
          <h3 className="text-sm font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>Financial Snapshot Unavailable</h3>
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
            <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>— Intelligence</div>
            <h1 className="font-medium mb-1" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>Reports <em style={{ fontStyle: 'italic', color: '#E85D00' }}>centre</em>.</h1>
            <p className="text-sm" style={{ color: '#8FA0B8' }}>Verified intelligence from connected data sources only.</p>
          </div>
          <div className="flex items-center gap-2">
            {hasEvents && (
              <button onClick={handleExportPDF} disabled={generating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:bg-white/5 disabled:opacity-50"
                style={{ color: 'var(--biqc-text-2)', border: '1px solid var(--biqc-border)', fontFamily: fontFamily.mono }}
                data-testid="export-pdf-btn">
                <Download className="w-3.5 h-3.5" />
                {generating ? 'Generating...' : 'Export PDF'}
              </button>
            )}
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: '#E85D00' }} data-testid="new-report-btn">
              <FileText className="w-3.5 h-3.5" /> New report
            </button>
          </div>
        </div>

        {/* Report category tabs — matches mockup */}
        <div className="flex gap-1 border-b overflow-x-auto mb-6" style={{ borderColor: 'var(--biqc-border)' }} data-testid="reports-tabs">
          {['All reports', 'Revenue', 'Operations', 'Pipeline', 'Team', 'Scheduled'].map((tab, i) => (
            <button key={tab} className="px-4 py-3 text-sm font-medium whitespace-nowrap transition-all" style={{ color: i === 0 ? '#EDF1F7' : '#8FA0B8', borderBottom: i === 0 ? '2px solid #E85D00' : '2px solid transparent' }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Report Card Grid — matches mockup reports-grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {[
            { title: 'Morning Brief — Apr 10', desc: 'Pipeline down 43% this fortnight. Bramwell silent 9 days. Cash runway stable at 4.2 months.', type: 'AI Generated', typeBg: 'rgba(232,93,0,0.12)', typeColor: '#E85D00', meta: 'Today, 7:00 AM', metaSub: 'Auto-generated', previewBg: 'linear-gradient(135deg, rgba(232,93,0,0.08), rgba(140,170,210,0.06))' },
            { title: 'Weekly Revenue Summary', desc: '$26.7K MRR, 8 active deals, 23% close rate. Bookings on track for $29K this month.', type: 'Weekly', typeBg: 'rgba(59,130,246,0.12)', typeColor: '#3B82F6', meta: 'Apr 7', metaSub: 'Every Monday', previewBg: 'rgba(140,170,210,0.06)' },
            { title: 'Pipeline Health Diagnosis', desc: '2 deals at risk (Bramwell, Meridian), 3 healthy, 3 new. Negotiation bottleneck identified.', type: 'AI Generated', typeBg: 'rgba(232,93,0,0.12)', typeColor: '#E85D00', meta: 'Apr 9', metaSub: 'On demand', previewBg: 'rgba(140,170,210,0.06)' },
            { title: 'Operations Scorecard', desc: 'Ops score 74 (-3). Lead response healthy. Invoice approval and deal follow-up below target.', type: 'Weekly', typeBg: 'rgba(59,130,246,0.12)', typeColor: '#3B82F6', meta: 'Apr 7', metaSub: 'Every Monday', previewBg: 'rgba(140,170,210,0.06)' },
            { title: 'Team Performance — Q1 2026', desc: '38 tasks completed this week across 3 team members. Andreas leads but is meeting-overloaded.', type: 'Manual', typeBg: 'rgba(140,170,210,0.08)', typeColor: '#8FA0B8', meta: 'Apr 1', metaSub: 'Quarterly', previewBg: 'rgba(140,170,210,0.06)' },
            { title: 'Cash Flow Projection', desc: '4.2 months runway at current $38K/mo burn. Extends to 6.1 months if Bramwell closes.', type: 'AI Generated', typeBg: 'rgba(232,93,0,0.12)', typeColor: '#E85D00', meta: 'Apr 8', metaSub: 'Auto-generated', previewBg: 'linear-gradient(135deg, rgba(217,119,6,0.08), rgba(140,170,210,0.06))' },
          ].map(r => (
            <div key={r.title} className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:border-[rgba(140,170,210,0.25)] hover:-translate-y-0.5" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.12)' }}>
              <div className="h-[120px] flex items-center justify-center relative" style={{ background: r.previewBg }}>
                <span className="absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full" style={{ background: r.typeBg, color: r.typeColor, fontFamily: fontFamily.mono }}>{r.type}</span>
                <FileText className="w-8 h-8" style={{ color: 'rgba(140,170,210,0.3)' }} />
              </div>
              <div className="p-5">
                <h3 className="text-sm font-semibold mb-1" style={{ color: '#EDF1F7' }}>{r.title}</h3>
                <p className="text-xs leading-relaxed mb-3" style={{ color: '#8FA0B8', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.desc}</p>
                <div className="flex items-center gap-3 text-[11px]" style={{ color: '#708499', fontFamily: fontFamily.mono }}>
                  <span>{r.meta}</span>
                  <span className="w-1 h-1 rounded-full" style={{ background: '#708499' }} />
                  <span>{r.metaSub}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Scheduled Reports — matches mockup sched-card */}
        <div className="rounded-2xl p-6 mb-8" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.12)' }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: '#3B82F6' }} />
              <span className="text-sm font-semibold" style={{ color: '#EDF1F7' }}>Scheduled reports</span>
            </div>
            <button className="text-xs font-medium" style={{ color: '#8FA0B8' }}>+ Add schedule</button>
          </div>
          {[
            { name: 'Morning Brief', detail: 'Sent to andreas@thestrategysquad.com.au at 7:00 AM AEST', freq: 'Daily', on: true },
            { name: 'Weekly Revenue Summary', detail: 'Generated every Monday at 8:00 AM AEST', freq: 'Weekly', on: true },
            { name: 'Operations Scorecard', detail: 'Generated every Monday at 8:00 AM AEST', freq: 'Weekly', on: true },
            { name: 'Cash Flow Alert', detail: 'Triggered when runway drops below 4 months', freq: 'Threshold', on: false },
          ].map((s, i) => (
            <div key={s.name} className="flex items-center gap-4 py-4" style={{ borderBottom: i < 3 ? '1px solid rgba(140,170,210,0.08)' : 'none' }}>
              <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}>
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#EDF1F7' }}>{s.name}</p>
                <p className="text-xs" style={{ color: '#8FA0B8' }}>{s.detail}</p>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'rgba(140,170,210,0.06)', color: '#708499', fontFamily: fontFamily.mono }}>{s.freq}</span>
              <div className="w-9 h-5 rounded-full relative cursor-pointer shrink-0" style={{ background: s.on ? '#16A34A' : 'rgba(140,170,210,0.2)' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: s.on ? '18px' : '2px' }} />
              </div>
            </div>
          ))}
        </div>

        {/* ── FORENSIC REPORTS SECTION ── */}
        <ForensicReportCard />

        {advisoryMemos.length > 0 && (
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>Advisory Board Memos</h3>
            <p className="text-xs text-[#64748B] mb-3">Recorded from video advisory sessions. Includes summary and owner action cues.</p>
            <div className="space-y-2">
              {advisoryMemos.slice(0, 5).map((memo) => (
                <div key={memo.id} className="rounded-lg p-3" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold text-[#EDF1F7]">{memo.title || 'Advisory Memo'}</p>
                    <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                      {formatDuration(memo.duration_seconds || 0)}
                    </span>
                  </div>
                  <p className="text-xs text-[#8FA0B8] mb-2">{memo.summary}</p>
                  {Array.isArray(memo.action_items) && memo.action_items.length > 0 && (
                    <div className="space-y-1">
                      {memo.action_items.slice(0, 3).map((item, idx) => (
                        <p key={`${memo.id}-${idx}`} className="text-[11px] text-[#EDF1F7]">- {item}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}

        <Panel data-testid="market-insights-report-panel">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-[#3B82F6]" />
            <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Market Insights Report</h3>
          </div>
          {marketInsightsReport ? (
            <div className="space-y-3">
              {marketInsightsReport?.forensic_memo && (
                <div className="rounded-lg p-3" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>CMO Forensic Memo</p>
                  <p className="text-xs text-[#8FA0B8] mt-1.5 leading-relaxed">{marketInsightsReport.forensic_memo}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg p-3" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                  <p className="text-[10px] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>SEO Ranking Summary</p>
                  <p className="text-xs text-[#CBD5E1] mt-1">{marketInsightsReport?.seo_rank_summary || 'Data not available on free tier.'}</p>
                </div>
                <div className="rounded-lg p-3" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                  <p className="text-[10px] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Paid Marketing Summary</p>
                  <p className="text-xs text-[#CBD5E1] mt-1">{marketInsightsReport?.paid_rank_summary || 'Data not available on free tier.'}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#64748B]">No Market Insights report available yet. Run calibration to generate the CMO report.</p>
          )}
        </Panel>

        {loading && <PageLoadingState message="Loading intelligence reports..." />}

        {!loading && loadError && (
          <PageErrorState error={loadError} onRetry={loadReportsData} moduleName="Reports" />
        )}

        {!loading && !loadError && !hasAnyIntegration && (
          <Panel className="text-center py-12">
            <Plug className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
            <p className="text-sm text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>No integrations connected.</p>
            <p className="text-xs text-[#64748B] mb-4 max-w-md mx-auto">
              Connect your CRM, accounting, and email integrations to generate verified intelligence reports.
              Reports contain only data from connected, verified sources.
            </p>
            <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#E85D00' }} data-testid="reports-connect-cta">
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
                      <span className="text-[10px] text-[#8FA0B8] capitalize" style={{ fontFamily: fontFamily.mono }}>{type}</span>
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
                <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>Financial Snapshot</h3>
                <p className="text-xs text-[#8FA0B8]">Financial data from connected accounting integration. Metrics computed from verified transaction records.</p>
              </Panel>
            ) : renderFinancialNullState()}

            {/* Governance Events Summary */}
            {hasEvents ? (
              <Panel>
                <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>Signal Summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Total Events</span>
                    <span className="text-xl font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{events.length}</span>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Avg Confidence</span>
                    <span className="text-xl font-bold" style={{ fontFamily: fontFamily.mono, color: avgConfidence > 70 ? '#10B981' : '#F59E0B' }}>{avgConfidence}%</span>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Data Sources</span>
                    <span className="text-xl font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{integrations.length}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {events.slice(0, 10).map(ev => (
                    <div key={ev.id} className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: 'var(--biqc-bg)' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ev.confidence_score >= 0.7 ? '#10B981' : '#F59E0B' }} />
                      <span className="text-xs text-[#8FA0B8] flex-1 truncate">{ev.event_type}</span>
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
