import React, { useState } from 'react';
import { useSnapshot } from '../hooks/useSnapshot';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { apiClient } from '../lib/api';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import InsightExplainabilityStrip from './InsightExplainabilityStrip';

const STATE_CONFIG = {
  STABLE:      { label: 'Stable',      color: '#10B981', bg: '#10B98110', border: '#10B98130', dot: '#10B981' },
  DRIFT:       { label: 'Drift',       color: '#F59E0B', bg: '#F59E0B10', border: '#F59E0B30', dot: '#F59E0B' },
  COMPRESSION: { label: 'Compression', color: '#FF6A00', bg: '#FF6A0010', border: '#FF6A0030', dot: '#FF6A00' },
  CRITICAL:    { label: 'Critical',    color: '#EF4444', bg: '#EF444410', border: '#EF444430', dot: '#EF4444' },
};

const DIAGNOSIS_AREAS = [
  { id: 'cash_flow_financial_risk', label: 'Cash Flow & Financial Risk', icon: '$', color: '#16A34A', desc: 'Liquidity, payment obligations, and runway.' },
  { id: 'revenue_momentum', label: 'Revenue Momentum', icon: '\u2197', color: '#3B82F6', desc: 'Sales velocity, pipeline health, close rates.' },
  { id: 'strategy_effectiveness', label: 'Strategy Effectiveness', icon: '\u25CE', color: '#7C3AED', desc: 'Whether direction is producing expected outcomes.' },
  { id: 'operations_delivery', label: 'Operations & Delivery', icon: '\u2699', color: '#D97706', desc: 'Execution quality, timelines, bottlenecks.' },
  { id: 'people_retention_capacity', label: 'People & Capacity', icon: '\u2693', color: '#DB2777', desc: 'Team stability, workload, delegation gaps.' },
  { id: 'customer_relationships', label: 'Customer Relationships', icon: '\u2764', color: '#DC2626', desc: 'Client satisfaction, retention signals, churn risk.' },
  { id: 'risk_compliance', label: 'Risk & Compliance', icon: '\u26A0', color: '#EA580C', desc: 'Regulatory, contractual, and legal exposure.' },
  { id: 'systems_technology', label: 'Systems & Technology', icon: '\u2699', color: '#4F46E5', desc: 'Technical debt, reliability, infrastructure limits.' },
  { id: 'market_position', label: 'Market Position', icon: '\u2691', color: '#0D9488', desc: 'Competitive landscape, positioning, opportunity decay.' },
];

const formatFreshnessTime = (iso) => {
  if (!iso) return 'unknown';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'unknown';
  return parsed.toLocaleString();
};

const BoardRoom = ({ embeddedShell = false }) => {
  const [activeDiagnosis, setActiveDiagnosis] = useState(null);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagError, setDiagError] = useState(null);

  const { cognitive: snapshot, loading: briefingLoading } = useSnapshot();
  const { status: integrationStatus } = useIntegrationStatus();
  const narrative = snapshot ? { primary_tension: snapshot.executive_memo, force_summary: snapshot.system_state_interpretation, strategic_direction: snapshot.priority_compression?.primary_focus } : null;
  const st = STATE_CONFIG[snapshot?.system_state] || STATE_CONFIG.STABLE;
  const dpi = snapshot?.system_state === 'CRITICAL' ? 80 : snapshot?.system_state === 'COMPRESSION' ? 55 : snapshot?.system_state === 'DRIFT' ? 35 : 10;
  const forces = (snapshot?.inevitabilities || []).map(function(inv) { return { domain: inv.domain, detail: inv.signal, position: inv.intensity }; });
  const topAlerts = (snapshot?.top_alerts || []).slice(0, 3);
  const integrationMap = {
    crm: snapshot?.integrations?.crm ?? integrationStatus?.canonical_truth?.crm_connected,
    accounting: snapshot?.integrations?.accounting ?? integrationStatus?.canonical_truth?.accounting_connected,
    email: snapshot?.integrations?.email ?? integrationStatus?.canonical_truth?.email_connected,
  };
  const truthStateMap = {
    crm: integrationStatus?.canonical_truth?.crm_state || snapshot?.integrations?.crm_state,
    accounting: integrationStatus?.canonical_truth?.accounting_state || snapshot?.integrations?.accounting_state,
    email: integrationStatus?.canonical_truth?.email_state || snapshot?.integrations?.email_state,
  };
  const degradedTruth = Object.entries(truthStateMap).filter(([, state]) => state && state !== 'live');
  const freshness = integrationStatus?.canonical_truth?.freshness || {};
  const integrationLabels = Object.entries(integrationMap).filter(([, connected]) => connected).map(([key]) => key);
  const truthGateMessage = degradedTruth.length
    ? `Some of your data is out of date. BIQc is only using verified data while these tools refresh: ${degradedTruth.map(([domain, state]) => `${domain} (${state})`).join(', ')}.`
    : null;
  const primaryBrief = degradedTruth.length ? (topAlerts[0]?.detail || truthGateMessage) : (narrative?.primary_tension || topAlerts[0]?.detail);
  const hasBrief = Boolean(primaryBrief);
  const explainCards = [
    {
      title: 'Why BIQc is escalating this',
      value: topAlerts[0]?.detail || truthGateMessage || narrative?.force_summary || 'This is the strongest live signal across your connected systems right now.',
    },
    {
      title: 'Data behind it',
      value: `${snapshot?.live_signal_count || topAlerts.length || 0} live signal${(snapshot?.live_signal_count || topAlerts.length || 0) === 1 ? '' : 's'} across ${integrationLabels.length || 0} connected system${integrationLabels.length === 1 ? '' : 's'}${integrationLabels.length ? ` (${integrationLabels.join(', ')})` : ''}.`,
    },
    {
      title: 'Act next',
      value: topAlerts[0]?.action || narrative?.strategic_direction || 'Use Boardroom diagnosis to identify the best next move before this spreads.',
    },
  ];
  const explainability = {
    whyVisible: integrationLabels.length
      ? `Boardroom is escalating this based on ${integrationLabels.length} connected system${integrationLabels.length === 1 ? '' : 's'} (${integrationLabels.join(', ')}).`
      : 'Boardroom is active, but richer diagnosis needs connected systems and live signals.',
    whyNow: topAlerts[0]?.detail || truthGateMessage || narrative?.force_summary || 'Signal pressure is rising across your monitored domains.',
    nextAction: topAlerts[0]?.action || narrative?.strategic_direction || 'Run a diagnosis area and commit to one decision in this session.',
    ifIgnored: diagnosisResult?.if_ignored || 'Decision delay narrows options and increases second-order impact across delivery, cash, and customers.',
  };

  const runDiagnosis = async (area) => {
    setActiveDiagnosis(area.id);
    setDiagnosisResult(null);
    setDiagError(null);
    setDiagnosing(true);
    try {
      const res = await apiClient.post('/boardroom/diagnosis', { focus_area: area.id });
      setDiagnosisResult(res.data);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setDiagError(detail || 'Diagnosis unavailable. Please try again.');
    } finally { setDiagnosing(false); }
  };

  const closeDiagnosis = () => { setActiveDiagnosis(null); setDiagnosisResult(null); setDiagError(null); };
  const activeArea = DIAGNOSIS_AREAS.find(a => a.id === activeDiagnosis);

  return (
    <div className={`flex flex-col h-full ${embeddedShell ? 'min-h-full' : 'min-h-screen'}`} style={{ background: 'var(--biqc-bg, #070E18)', fontFamily: fontFamily.display }}>

      {/* ═══ HEADER — Dark themed ═══ */}
      <header className="flex items-center justify-between px-6 md:px-10 py-3.5 shrink-0"
        style={{ background: 'rgba(10,16,24,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--biqc-border, #1E2D3D)' }}>
        <div className="flex items-center gap-5">
          <a href="/advisor" className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: '#64748B', textDecoration: 'none', fontFamily: fontFamily.display }} data-testid="boardroom-home">
            ← Intelligence Platform
          </a>
          <div className="h-4 w-px" style={{ background: '#1E2D3D' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--biqc-text, #F4F7FA)' }}>Boardroom</span>
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full" style={{ background: st.bg, border: `1px solid ${st.border}` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
            <span className="text-[10px] font-semibold tracking-wide" style={{ color: st.color, fontFamily: fontFamily.mono }}>{st.label}</span>
          </div>
        </div>
        <span className="text-[11px] font-medium" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </header>

      {/* ═══ PRESSURE BAR ═══ */}
      <div className="h-[2px] shrink-0" style={{ background: '#1E2D3D' }}>
        <div className="h-full transition-all duration-1000 rounded-r-full" style={{ width: `${dpi}%`, background: st.dot }} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 md:px-10 py-10 space-y-10">

          {/* ═══ EXECUTIVE BRIEFING ═══ */}
          {!activeDiagnosis && (
            <>
              <section data-testid="executive-zone">
                {degradedTruth.length > 0 && (
                  <div className="mb-5 p-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.28)' }} data-testid="boardroom-truth-state-banner">
                    <span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>Data freshness</span>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--biqc-text-2, #9FB0C3)' }}>
                      Some data sources need refreshing: {degradedTruth.map(([domain, state]) => `${domain} (${state})`).join(', ')}.
                    </p>
                    <p className="text-xs leading-relaxed mt-2" style={{ color: 'var(--biqc-text-2, #9FB0C3)' }}>
                      Last sync — CRM: {formatFreshnessTime(freshness?.crm?.last_synced_at)}, Accounting: {formatFreshnessTime(freshness?.accounting?.last_synced_at)}, Email: {formatFreshnessTime(freshness?.email?.last_synced_at)}.
                    </p>
                  </div>
                )}
                {briefingLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <span className="text-xs" style={{ color: "#FF6A00", fontFamily: "monospace" }}>thinking...</span>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {hasBrief && (
                      <div className="p-7 rounded-2xl"
                        style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)', border: '1px solid var(--biqc-border, #1E2D3D)' }}>
                        <p className="text-[15px] leading-relaxed" style={{ color: 'var(--biqc-text, #F4F7FA)' }}>
                          {typeof narrative === 'string' ? narrative : primaryBrief}
                        </p>
                        {narrative.force_summary && !degradedTruth.length && (
                          <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--biqc-text-2, #9FB0C3)' }}>{narrative.force_summary}</p>
                        )}
                        {narrative.strategic_direction && !degradedTruth.length && (
                          <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--biqc-border, #1E2D3D)' }}>
                            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>Direction</span>
                            <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--biqc-text-2, #9FB0C3)' }}>{narrative.strategic_direction}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {!hasBrief && (
                      <div className="p-7 rounded-2xl text-center"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--biqc-border, #1E2D3D)' }}>
                        <p className="text-sm" style={{ color: '#64748B' }}>
                          {integrationLabels.length
                            ? `BIQc can already see ${integrationLabels.join(', ')} data, but the executive briefing synthesis is still catching up.`
                            : 'Executive briefing will appear here once intelligence is generated.'}
                        </p>
                      </div>
                    )}

                    {forces.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {forces.map((f, i) => (
                          <div key={i} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--biqc-border, #1E2D3D)' }}>
                            <span className="text-xs font-semibold" style={{ color: 'var(--biqc-text, #F4F7FA)' }}>{f.domain}</span>
                            {f.detail && <p className="text-[11px] mt-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{f.detail}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {explainCards.map((card) => (
                        <div key={card.title} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--biqc-border, #1E2D3D)' }}>
                          <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{card.title}</span>
                          <p className="text-[12px] mt-2 leading-relaxed" style={{ color: 'var(--biqc-text-2, #9FB0C3)' }}>{card.value}</p>
                        </div>
                      ))}
                    </div>

                    <InsightExplainabilityStrip
                      whyVisible={explainability.whyVisible}
                      whyNow={explainability.whyNow}
                      nextAction={explainability.nextAction}
                      ifIgnored={explainability.ifIgnored}
                      testIdPrefix="boardroom-explainability"
                    />
                  </div>
                )}
              </section>

              {/* ═══ DIAGNOSIS CARDS ═══ */}
              <section data-testid="diagnosis-zone">
                <h2 className="text-[10px] font-semibold tracking-widest uppercase mb-5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
                  Diagnosis — Select an area to analyse
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {DIAGNOSIS_AREAS.map((area) => (
                    <button
                      key={area.id}
                      onClick={() => runDiagnosis(area)}
                      className="text-left p-5 rounded-xl transition-all hover:-translate-y-0.5 group"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--biqc-border, #1E2D3D)', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = area.color + '40'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--biqc-border, #1E2D3D)'}
                      data-testid={`diagnosis-${area.id}`}>
                      <div className="flex items-center gap-3 mb-2.5">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-medium" style={{ background: `${area.color}15`, color: area.color }}>{area.icon}</span>
                        <span className="text-sm font-semibold" style={{ color: 'var(--biqc-text, #F4F7FA)' }}>{area.label}</span>
                      </div>
                      <p className="text-[12px] leading-relaxed" style={{ color: '#64748B' }}>{area.desc}</p>
                      <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-medium" style={{ color: area.color }}>Run diagnosis</span>
                        <ChevronRight className="w-3 h-3" style={{ color: area.color }} />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ═══ DIAGNOSIS RESULT ═══ */}
          {activeDiagnosis && (
            <section data-testid="diagnosis-result">
              <button onClick={closeDiagnosis} className="flex items-center gap-2 text-xs font-medium mb-8 px-3 py-1.5 rounded-lg transition-colors hover:bg-black/5" style={{ color: '#64748B' }}>
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Boardroom
              </button>

              {diagnosing && (
                <div className="flex flex-col items-center justify-center py-24">
                  <span className="text-xs" style={{ color: "#FF6A00", fontFamily: "monospace" }}>thinking...</span>
                  <p className="text-sm font-medium" style={{ color: '#243140' }}>Analysing {activeArea?.label}...</p>
                  <p className="text-[11px] mt-1.5" style={{ color: '#64748B' }}>Reading your CRM, financials, and email signals</p>
                </div>
              )}

              {diagError && (
                <div className="p-8 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <p className="text-sm" style={{ color: '#D97706' }}>{diagError}</p>
                  <button onClick={() => runDiagnosis(activeArea)} className="text-xs font-medium mt-4 px-4 py-1.5 rounded-lg" style={{ color: '#64748B', border: '1px solid #E5E7EB' }}>Retry</button>
                </div>
              )}

              {diagnosisResult && (
                <div className="space-y-5">
                  {diagnosisResult.degraded && (
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }} data-testid="boardroom-diagnosis-degraded-banner">
                      <span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>Resilience mode</span>
                      <p className="text-xs leading-relaxed" style={{ color: '#243140' }}>
                        Upstream diagnosis service is unstable. BIQc is returning telemetry-grounded fallback guidance so decision execution can continue.
                      </p>
                    </div>
                  )}

                  {/* Headline */}
                  <div className="p-8 rounded-2xl" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div className="flex items-center gap-3 mb-5">
                      {activeArea && <span className="w-10 h-10 rounded-xl flex items-center justify-center text-base" style={{ background: `${activeArea.color}10`, color: activeArea.color }}>{activeArea.icon}</span>}
                      <div>
                        <h2 className="text-lg font-semibold" style={{ color: '#111827' }}>{activeArea?.label}</h2>
                        {diagnosisResult.confidence && (
                          <span className="text-[10px] tracking-wider uppercase font-medium" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Confidence: {diagnosisResult.confidence}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-lg leading-relaxed break-words" style={{ color: '#1F2937', fontWeight: 500 }}>{diagnosisResult.headline}</p>
                  </div>

                  {/* Narrative */}
                  {diagnosisResult.narrative && (
                    <div className="p-8 rounded-2xl" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <p className="text-[15px] leading-loose whitespace-pre-wrap break-words" style={{ color: '#243140' }}>{diagnosisResult.narrative}</p>
                    </div>
                  )}

                  {/* What to Watch */}
                  {diagnosisResult.what_to_watch && (
                    <div className="p-6 rounded-2xl" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                      <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>What to Watch</span>
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap" style={{ color: '#9FB0C3' }}>{diagnosisResult.what_to_watch}</p>
                    </div>
                  )}

                  {diagnosisResult.if_ignored && (
                    <div className="p-6 rounded-2xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                      <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#EF4444', fontFamily: fontFamily.mono }}>If Ignored</span>
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap" style={{ color: '#9FB0C3' }}>{diagnosisResult.if_ignored}</p>
                    </div>
                  )}

                  {(diagnosisResult.why_visible || diagnosisResult.why_now || diagnosisResult.next_action || diagnosisResult.if_ignored) && (
                    <InsightExplainabilityStrip
                      whyVisible={diagnosisResult.why_visible || explainability.whyVisible}
                      whyNow={diagnosisResult.why_now || explainability.whyNow}
                      nextAction={diagnosisResult.next_action || explainability.nextAction}
                      ifIgnored={diagnosisResult.if_ignored || explainability.ifIgnored}
                      testIdPrefix="boardroom-diagnosis-explainability"
                    />
                  )}

                  {diagnosisResult.evidence_chain?.length > 0 && (
                    <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--biqc-border, #1E2D3D)' }} data-testid="boardroom-diagnosis-evidence-chain">
                      <span className="text-[10px] font-semibold tracking-widest uppercase block mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Evidence Chain</span>
                      <div className="space-y-2">
                        {diagnosisResult.evidence_chain.slice(0, 5).map((signal, idx) => (
                          <div key={idx} className="text-[11px]" style={{ color: 'var(--biqc-text-2, #9FB0C3)' }}>
                            {(signal.domain || 'domain').toUpperCase()} · {(signal.event_type || 'event')} · {(signal.severity || 'info')} · {(signal.source || 'source')}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {diagnosisResult.data_sources_used?.length > 0 && (
                    <div className="flex items-center gap-3 pt-2">
                      <span className="text-[10px] font-medium" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Sources:</span>
                      {diagnosisResult.data_sources_used.map((s, i) => (
                        <span key={i} className="text-[10px] px-2.5 py-1 rounded-full font-medium" style={{ color: '#9FB0C3', background: 'rgba(255,255,255,0.06)', fontFamily: fontFamily.mono }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default BoardRoom;
