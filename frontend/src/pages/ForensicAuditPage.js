import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import UpgradeCardsGate from '../components/UpgradeCardsGate';
import { apiClient } from '../lib/api';
import { Search, Shield, AlertTriangle, CheckCircle2, XCircle, Loader2, Layers, Filter, Brain, Clock, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
);

const StatusBadge = ({ status }) => {
  const config = {
    pass: { color: '#10B981', label: 'PASS' },
    warning: { color: '#F59E0B', label: 'WARNING' },
    fail: { color: '#EF4444', label: 'FAIL' },
    skipped: { color: '#64748B', label: 'SKIPPED' },
    insufficient_data: { color: '#64748B', label: 'NO DATA' },
  };
  const c = config[status] || config.skipped;
  return <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ color: c.color, background: c.color + '15', fontFamily: fontFamily.mono }}>{c.label}</span>;
};

const FailureCode = ({ code }) => {
  const descriptions = {
    A1_dom_drift: 'Main content container not captured',
    A2_js_render_failure: 'Content present on site but absent in capture',
    A3_navigation_dominance: '40%+ of captured text is menu/footer',
    A4_redirect_misalignment: 'Scraper did not follow redirect chain',
    A5_partial_fetch: 'Truncated or insufficient HTML',
    B1_noise_retention: 'Boilerplate still dominant after cleaning',
    B2_core_signal_loss: 'Core content removed during cleaning',
    B3_temporal_bias: 'Blog content over-weighted vs static pages',
    B4_misidentified_content: 'Parser treated sidebar as core',
    C1_numeric_hallucination: 'Invented numeric value not in source',
    C2_industry_assumption: 'Industry classification not in source',
    C3_competitive_guesswork: 'Competitor name not found in source',
    C4_overgeneralisation: 'Generic claim without evidence',
    C5_ai_narrative_fill: 'AI-generated filler phrase',
    D1_legacy_bias: 'Stale copyright or outdated content',
    D2_blog_recency_overweight: 'Blog date over-weighted',
    D3_ignored_fresh_content: 'Recent content ignored',
  };
  return (
    <div className="flex items-start gap-2 p-2 rounded" style={{ background: '#EF444408', border: '1px solid #EF444415' }}>
      <XCircle className="w-3.5 h-3.5 text-[#EF4444] shrink-0 mt-0.5" />
      <div>
        <span className="text-xs font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{code}</span>
        <p className="text-[10px] text-[#64748B] mt-0.5">{descriptions[code] || code}</p>
      </div>
    </div>
  );
};

const CollapsibleSection = ({ title, icon: Icon, color, status, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Panel>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '15' }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>{title}</h3>
          <StatusBadge status={status} />
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
      </button>
      {open && <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--biqc-border)' }}>{children}</div>}
    </Panel>
  );
};

const ForensicAuditPage = () => {
  const [url, setUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient.get('/ingestion/history').then(res => {
      setHistory(res.data?.sessions || []);
    }).catch(() => {
      apiClient.get('/forensic/ingestion-history').then(res => {
        setHistory(res.data?.audits || []);
      }).catch(() => {});
    });
  }, []);

  const runAudit = async () => {
    if (!url.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      // Use hybrid ingestion engine (headless + static)
      const res = await apiClient.post('/ingestion/hybrid', { url: url.trim() });
      setResult(res.data);
      apiClient.get('/ingestion/history').then(r => setHistory(r.data?.sessions || [])).catch(() => {});
    } catch (err) {
      // Fallback to standard ingestion
      try {
        const res2 = await apiClient.post('/ingestion/run', { url: url.trim() });
        setResult(res2.data);
      } catch (err2) {
        setError(err2.response?.data?.detail || err.response?.data?.detail || 'Audit failed');
      }
    } finally {
      setRunning(false);
    }
  };

  // Support both old audit format and new ingestion format
  const isNewFormat = result?.quality_score != null;
  const ext = result?.extraction || {};
  const cln = result?.cleaning || {};
  const syn = result?.synthesis || {};
  const meta = result?.metadata || {};
  const verdict = result?.verdict || {};

  return (
    <DashboardLayout>
      <UpgradeCardsGate requiredTier="starter" featureName="Forensic Ingestion Audit">
      <div className="space-y-6 max-w-[1000px]" style={{ fontFamily: fontFamily.body }} data-testid="forensic-audit-page">
        <div>
          <h1 className="text-2xl font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>Forensic Ingestion Audit</h1>
          <p className="text-sm text-[#8FA0B8] mb-2">3-layer deterministic analysis of a public URL — tests data extraction quality, DOM cleaning, and synthesis integrity.</p>
          <div className="p-3 rounded-lg" style={{ background: 'rgba(232,93,0,0.04)', border: '1px solid rgba(232,93,0,0.12)' }}>
            <p className="text-[11px] font-semibold mb-1" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>WHAT THIS DOES</p>
            <p className="text-xs text-[#8FA0B8] mb-2">
              Enter any public business URL and BIQc will analyse how cleanly data can be extracted from it. Use this to verify your own website or a competitor's page before connecting it as a data source.
            </p>
            <p className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
              Example valid URLs: yourcompany.com • hubspot.com/about • xero.com/au
            </p>
          </div>
        </div>

        {/* URL Input */}
        <Panel>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runAudit()}
                placeholder="Enter public URL to audit e.g. yourwebsite.com.au *"
                className="w-full h-11 pl-10 pr-4 rounded-lg text-sm outline-none"
                style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)', fontFamily: fontFamily.body }}
                disabled={running}
                data-testid="audit-url-input"
              />
            </div>
            <button
              onClick={runAudit}
              disabled={running || !url.trim()}
              className="px-6 h-11 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50"
              style={{ background: '#E85D00' }}
              data-testid="audit-run-btn"
            >
              {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Auditing...</> : <><Shield className="w-4 h-4" /> Run Audit</>}
            </button>
          </div>
          {error && <p className="text-xs text-[#EF4444] mt-2">{error}</p>}
          <p className="text-[10px] mt-2" style={{ color: '#4A5568', fontFamily: fontFamily.mono }}>* URL must be publicly accessible. HTTPS preferred. No login-protected pages.</p>
        </Panel>

        {/* Loading */}
        {running && (
          <Panel className="text-center py-10">
            <Loader2 className="w-8 h-8 text-[#E85D00] mx-auto mb-3 animate-spin" />
            <p className="text-sm text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>Running forensic audit...</p>
            <p className="text-xs text-[#64748B]">Fetching URL, cleaning DOM, analysing synthesis integrity. This takes 15–30 seconds.</p>
          </Panel>
        )}

        {/* Results */}
        {result && !running && (
          <div className="space-y-4">
            {/* NEW FORMAT: Quality Score Banner */}
            {isNewFormat && (
              <div className="rounded-xl p-6" style={{
                background: (result.scores?.trust_integrity_score || result.quality_score) >= 70 ? '#10B98108' : (result.scores?.trust_integrity_score || result.quality_score) >= 50 ? '#F59E0B08' : '#EF444408',
                border: `1px solid ${(result.scores?.trust_integrity_score || result.quality_score) >= 70 ? '#10B98125' : (result.scores?.trust_integrity_score || result.quality_score) >= 50 ? '#F59E0B25' : '#EF444425'}`,
              }} data-testid="audit-verdict">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {(result.scores?.trust_integrity_score || result.quality_score) >= 70 ? <CheckCircle2 className="w-5 h-5 text-[#10B981]" /> : <AlertTriangle className="w-5 h-5 text-[#EF4444]" />}
                    <h2 className="text-lg font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>
                      {result.scores ? `Trust Integrity: ${result.scores.confidence_level}` : `Ingestion Quality: ${result.confidence_level}`}
                    </h2>
                  </div>
                  <span className="text-2xl font-bold" style={{ color: (result.scores?.trust_integrity_score || result.quality_score) >= 70 ? '#10B981' : (result.scores?.trust_integrity_score || result.quality_score) >= 50 ? '#F59E0B' : '#EF4444', fontFamily: fontFamily.mono }}>
                    {result.scores?.trust_integrity_score || result.quality_score}/100
                  </span>
                </div>
                {/* Trust Message */}
                {result.trust_message && (
                  <div className="p-3 rounded-lg mb-3 flex items-start gap-2" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                    <Shield className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#F59E0B]">{result.trust_message}</p>
                  </div>
                )}
                {/* Render Mode */}
                {result.render_mode && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: result.render_mode === 'headless' ? '#7C3AED' : '#3B82F6', background: (result.render_mode === 'headless' ? '#7C3AED' : '#3B82F6') + '15', fontFamily: fontFamily.mono }}>
                      {result.render_mode === 'headless' ? 'HEADLESS RENDER' : result.render_mode === 'static_fallback' ? 'STATIC FALLBACK' : 'STATIC FETCH'}
                    </span>
                    {result.js_detection?.spa_signatures?.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#F59E0B', background: '#F59E0B15', fontFamily: fontFamily.mono }}>
                        JS: {result.js_detection.spa_signatures.join(', ')}
                      </span>
                    )}
                  </div>
                )}
                {/* Layer Scores */}
                {result.scores && (
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="p-3 rounded text-center" style={{ background: 'var(--biqc-bg)' }}>
                      <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Extraction</span>
                      <span className="text-lg font-bold" style={{ color: result.scores.extraction_score >= 60 ? '#10B981' : '#F59E0B', fontFamily: fontFamily.mono }}>{result.scores.extraction_score}</span>
                    </div>
                    <div className="p-3 rounded text-center" style={{ background: 'var(--biqc-bg)' }}>
                      <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Cleaning</span>
                      <span className="text-lg font-bold" style={{ color: result.scores.cleaning_score >= 60 ? '#10B981' : '#F59E0B', fontFamily: fontFamily.mono }}>{result.scores.cleaning_score}</span>
                    </div>
                    <div className="p-3 rounded text-center" style={{ background: 'var(--biqc-bg)' }}>
                      <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Synthesis</span>
                      <span className="text-lg font-bold" style={{ color: result.scores.synthesis_score >= 60 ? '#10B981' : '#F59E0B', fontFamily: fontFamily.mono }}>{result.scores.synthesis_score}</span>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Pages Crawled</span>
                    <span className="text-lg font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{result.pages_crawled}/7</span>
                  </div>
                  <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Noise Ratio</span>
                    <span className="text-lg font-bold" style={{ color: result.noise_ratio > 0.35 ? '#EF4444' : '#10B981', fontFamily: fontFamily.mono }}>{result.noise_ratio}</span>
                  </div>
                  <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Hallucination</span>
                    <span className="text-lg font-bold" style={{ color: result.hallucination_score > 0.05 ? '#EF4444' : '#10B981', fontFamily: fontFamily.mono }}>{result.hallucination_score}</span>
                  </div>
                  <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Fields Found</span>
                    <span className="text-lg font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{Object.keys(result.dna_trace || {}).length}</span>
                  </div>
                </div>
                {result.failure_codes?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {result.failure_codes.map((c, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#EF4444', background: '#EF444415', fontFamily: fontFamily.mono }}>{c}</span>)}
                  </div>
                )}
              </div>
            )}

            {/* NEW FORMAT: Pages Crawled */}
            {isNewFormat && result.pages?.length > 0 && (
              <CollapsibleSection title="Pages Crawled" icon={Layers} color="#3B82F6" status={result.extraction_status || 'pass'} defaultOpen>
                <div className="space-y-2">
                  {result.pages.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <span className="text-[10px] w-6 text-center font-bold" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>P{p.priority}</span>
                      <span className="text-xs text-[#EDF1F7] flex-1 truncate">{p.url}</span>
                      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{(p.html_length || 0).toLocaleString()} chars</span>
                      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{p.fetch_time_ms}ms</span>
                    </div>
                  ))}
                </div>
                {result.canonical_url && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-[#8FA0B8]">
                    <ExternalLink className="w-3 h-3" /> Canonical: <span style={{ fontFamily: fontFamily.mono }}>{result.canonical_url}</span>
                  </div>
                )}
              </CollapsibleSection>
            )}

            {/* NEW FORMAT: Business DNA Trace */}
            {isNewFormat && result.dna_trace && Object.keys(result.dna_trace).length > 0 && (
              <CollapsibleSection title="Business DNA Trace" icon={Brain} color="#7C3AED" status="pass" defaultOpen>
                <div className="space-y-2">
                  {Object.entries(result.dna_trace).map(([field, trace]) => (
                    <div key={field} className="p-3 rounded" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-[#EDF1F7] capitalize">{field.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: trace.confidence >= 0.8 ? '#10B981' : '#F59E0B', background: (trace.confidence >= 0.8 ? '#10B981' : '#F59E0B') + '15', fontFamily: fontFamily.mono }}>{Math.round(trace.confidence * 100)}%</span>
                      </div>
                      <span className="text-sm text-[#3B82F6] block" style={{ fontFamily: fontFamily.mono }}>{trace.value}</span>
                      <span className="text-[10px] text-[#64748B] block mt-1 italic">"{trace.snippet}"</span>
                      {trace.source_url && <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Source: {trace.source_url}</span>}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* NEW FORMAT: Hallucinations & Lost Signals */}
            {isNewFormat && (result.hallucinations?.length > 0 || result.lost_signals?.length > 0) && (
              <CollapsibleSection title="Integrity Check" icon={Shield} color="#EF4444" status={result.hallucination_score > 0.05 ? 'fail' : result.hallucinations?.length > 0 ? 'warning' : 'pass'}>
                {result.hallucinations?.length > 0 && (
                  <div className="mb-3">
                    <span className="text-[10px] font-semibold text-[#EF4444] block mb-2" style={{ fontFamily: fontFamily.mono }}>HALLUCINATIONS ({result.hallucinations.length})</span>
                    {result.hallucinations.map((h, i) => (
                      <div key={i} className="p-2 rounded mb-1 text-xs" style={{ background: '#EF444408', border: '1px solid #EF444415' }}>
                        <span className="text-[#EDF1F7] font-semibold">{h.claim}</span>
                        <span className="text-[#64748B] ml-2">— {h.evidence}</span>
                      </div>
                    ))}
                  </div>
                )}
                {result.lost_signals?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-[#F59E0B] block mb-2" style={{ fontFamily: fontFamily.mono }}>LOST SIGNALS ({result.lost_signals.length})</span>
                    {result.lost_signals.map((s, i) => (
                      <div key={i} className="p-2 rounded mb-1 text-xs" style={{ background: '#F59E0B08', border: '1px solid #F59E0B15' }}>
                        <span className="text-[#EDF1F7]">{s.sentence?.substring(0, 120)}...</span>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>
            )}

            {/* NEW FORMAT: Quality Breakdown */}
            {isNewFormat && result.quality_breakdown && (
              <CollapsibleSection title="Quality Score Breakdown" icon={Filter} color="#10B981" status={result.quality_score >= 70 ? 'pass' : 'warning'}>
                <div className="space-y-2">
                  {Object.entries(result.quality_breakdown).map(([k, v]) => {
                    const isNegative = v < 0;
                    const color = isNegative ? '#EF4444' : '#10B981';
                    const pct = Math.abs(v);
                    return (
                      <div key={k}>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-[#8FA0B8] capitalize">{k.replace(/_/g, ' ')}</span>
                          <span className="text-xs font-semibold" style={{ color, fontFamily: fontFamily.mono }}>{isNegative ? '' : '+'}{v}</span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: color + '20' }}>
                          <div className="h-1.5 rounded-full" style={{ background: color, width: Math.min(pct * 4, 100) + '%' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            )}

            {/* OLD FORMAT: Verdict Banner (fallback) */}
            {!isNewFormat && (<>
            <div className="rounded-xl p-6" style={{
              background: verdict.primary_failure_layer === 'none' ? '#10B98108' : '#EF444408',
              border: `1px solid ${verdict.primary_failure_layer === 'none' ? '#10B98125' : '#EF444425'}`,
            }} data-testid="audit-verdict">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {verdict.primary_failure_layer === 'none' ? (
                    <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
                  )}
                  <h2 className="text-lg font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>
                    {verdict.primary_failure_layer === 'none' ? 'All Layers Pass' : `Primary Failure: ${verdict.primary_failure_layer?.toUpperCase()}`}
                  </h2>
                </div>
                <span className="text-lg font-bold" style={{ color: verdict.confidence >= 0.8 ? '#10B981' : '#F59E0B', fontFamily: fontFamily.mono }}>
                  {Math.round((verdict.confidence || 0) * 100)}%
                </span>
              </div>
              {verdict.secondary_failure_layer && (
                <p className="text-xs text-[#8FA0B8]">Secondary: {verdict.secondary_failure_layer}</p>
              )}
              {verdict.failure_codes?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {verdict.failure_codes.map((c, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#EF4444', background: '#EF444415', fontFamily: fontFamily.mono }}>{c}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Layer 1: Extraction */}
            <CollapsibleSection title="Layer 1 — Extraction" icon={Layers} color="#3B82F6" status={ext.status} defaultOpen>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>HTTP Status</span>
                  <span className="text-lg font-bold" style={{ color: ext.http_status === 200 ? '#10B981' : '#EF4444', fontFamily: fontFamily.mono }}>{ext.http_status}</span>
                </div>
                <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>HTML Length</span>
                  <span className="text-lg font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{(ext.raw_html_length || 0).toLocaleString()}</span>
                </div>
                <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Noise Ratio</span>
                  <span className="text-lg font-bold" style={{ color: ext.noise_ratio > 0.35 ? '#EF4444' : ext.noise_ratio > 0.2 ? '#F59E0B' : '#10B981', fontFamily: fontFamily.mono }}>{ext.noise_ratio}</span>
                </div>
                <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Fetch Time</span>
                  <span className="text-lg font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{ext.fetch_time_ms}ms</span>
                </div>
              </div>
              <div className="space-y-2 text-xs text-[#8FA0B8]">
                <div className="flex justify-between"><span>Final URL</span><span className="text-[#EDF1F7] truncate ml-4" style={{ fontFamily: fontFamily.mono }}>{ext.final_url}</span></div>
                <div className="flex justify-between"><span>Canonical URL</span><span className="text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{ext.canonical_url || 'Not set'}</span></div>
                <div className="flex justify-between"><span>Main Content</span><span style={{ color: ext.main_content_present ? '#10B981' : '#EF4444' }}>{ext.main_content_present ? 'Detected' : 'Not found'}</span></div>
                <div className="flex justify-between"><span>Structured Data</span><span style={{ color: ext.has_structured_data ? '#10B981' : '#64748B' }}>{ext.has_structured_data ? 'Found' : 'None'}</span></div>
                <div className="flex justify-between"><span>Redirects</span><span style={{ fontFamily: fontFamily.mono }}>{ext.redirect_chain?.length || 0}</span></div>
              </div>
              {ext.failure_codes?.length > 0 && (
                <div className="mt-3 space-y-1">{ext.failure_codes.map((c, i) => <FailureCode key={i} code={c} />)}</div>
              )}
            </CollapsibleSection>

            {/* Layer 2: Cleaning */}
            <CollapsibleSection title="Layer 2 — Semantic Cleaning" icon={Filter} color="#10B981" status={cln.status}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Unique Sentences</span>
                  <span className="text-lg font-bold" style={{ color: cln.unique_sentence_ratio > 0.7 ? '#10B981' : '#F59E0B', fontFamily: fontFamily.mono }}>{Math.round((cln.unique_sentence_ratio || 0) * 100)}%</span>
                </div>
                <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Core Weight</span>
                  <span className="text-lg font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{cln.core_content_weight}</span>
                </div>
                <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Nav Removed</span>
                  <span style={{ color: cln.nav_removed ? '#10B981' : '#64748B' }}>{cln.nav_removed ? 'Yes' : 'No'}</span>
                </div>
                <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Footer Removed</span>
                  <span style={{ color: cln.footer_removed ? '#10B981' : '#64748B' }}>{cln.footer_removed ? 'Yes' : 'No'}</span>
                </div>
              </div>
              {cln.sections?.length > 0 && (
                <div className="mb-3">
                  <span className="text-[10px] text-[#64748B] block mb-2" style={{ fontFamily: fontFamily.mono }}>Detected Sections</span>
                  <div className="flex flex-wrap gap-2">
                    {cln.sections.map((s, i) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded" style={{ background: 'var(--biqc-bg)', color: 'var(--biqc-text-2)', fontFamily: fontFamily.mono }}>
                        {s.name} (w:{s.weight}, {s.length} chars)
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {cln.failure_codes?.length > 0 && (
                <div className="space-y-1">{cln.failure_codes.map((c, i) => <FailureCode key={i} code={c} />)}</div>
              )}
            </CollapsibleSection>

            {/* Layer 3: Synthesis */}
            <CollapsibleSection title="Layer 3 — Cognitive Synthesis" icon={Brain} color="#7C3AED" status={syn.status}>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Hallucinations</span>
                  <span className="text-lg font-bold" style={{ color: (syn.hallucinations?.length || 0) > 0 ? '#EF4444' : '#10B981', fontFamily: fontFamily.mono }}>{syn.hallucinations?.length || 0}</span>
                </div>
                <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Lost Signals</span>
                  <span className="text-lg font-bold" style={{ color: (syn.lost_signals?.length || 0) > 0 ? '#F59E0B' : '#10B981', fontFamily: fontFamily.mono }}>{syn.lost_signals?.length || 0}</span>
                </div>
              </div>
              {syn.hallucinations?.length > 0 && (
                <div className="mb-3">
                  <span className="text-[10px] font-semibold text-[#EF4444] block mb-2" style={{ fontFamily: fontFamily.mono }}>HALLUCINATIONS DETECTED</span>
                  <div className="space-y-1">
                    {syn.hallucinations.map((h, i) => (
                      <div key={i} className="p-2 rounded text-xs" style={{ background: '#EF444408', border: '1px solid #EF444415' }}>
                        <span className="text-[#EDF1F7] font-semibold">{h.claim}</span>
                        <span className="text-[#64748B] ml-2">({h.type})</span>
                        <p className="text-[10px] text-[#64748B] mt-0.5">{h.evidence}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {syn.lost_signals?.length > 0 && (
                <div className="mb-3">
                  <span className="text-[10px] font-semibold text-[#F59E0B] block mb-2" style={{ fontFamily: fontFamily.mono }}>LOST SIGNALS</span>
                  <div className="space-y-1">
                    {syn.lost_signals.map((s, i) => (
                      <div key={i} className="p-2 rounded text-xs" style={{ background: '#F59E0B08', border: '1px solid #F59E0B15' }}>
                        <span className="text-[#EDF1F7] font-semibold">{s.type}: {s.value}</span>
                        <p className="text-[10px] text-[#64748B] mt-0.5">{s.evidence}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {syn.prompt_inference_flags?.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-[#F59E0B] block mb-2" style={{ fontFamily: fontFamily.mono }}>PROMPT INFERENCE FLAGS</span>
                  <div className="space-y-1">
                    {syn.prompt_inference_flags.map((f, i) => (
                      <div key={i} className="p-2 rounded text-xs" style={{ background: '#F59E0B08', border: '1px solid #F59E0B15' }}>
                        <span className="text-[#EDF1F7]">"{f.phrase}"</span>
                        <span className="text-[#64748B] ml-2">— {f.evidence}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {syn.failure_codes?.length > 0 && (
                <div className="mt-3 space-y-1">{syn.failure_codes.map((c, i) => <FailureCode key={i} code={c} />)}</div>
              )}
            </CollapsibleSection>

            {/* Metadata */}
            <CollapsibleSection title="Metadata & Freshness" icon={Clock} color="#F59E0B" status={meta.failure_codes?.length > 0 ? 'warning' : 'pass'}>
              <div className="space-y-2 text-xs text-[#8FA0B8]">
                <div className="flex justify-between"><span>Copyright Year</span><span style={{ color: meta.copyright_year && meta.copyright_year < 2025 ? '#F59E0B' : '#10B981', fontFamily: fontFamily.mono }}>{meta.copyright_year || 'Not found'}</span></div>
                <div className="flex justify-between"><span>Latest Blog Date</span><span style={{ fontFamily: fontFamily.mono }}>{meta.latest_blog_date || 'Not found'}</span></div>
                <div className="flex justify-between"><span>Freshness</span><span style={{ color: meta.freshness_status === 'current' ? '#10B981' : meta.freshness_status === 'stale' ? '#EF4444' : '#F59E0B', fontFamily: fontFamily.mono }}>{meta.freshness_status}</span></div>
              </div>
              {meta.failure_codes?.length > 0 && (
                <div className="mt-3 space-y-1">{meta.failure_codes.map((c, i) => <FailureCode key={i} code={c} />)}</div>
              )}
            </CollapsibleSection>

            {/* Remediation */}
            {verdict.remediation?.length > 0 && (
              <Panel>
                <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>Remediation Recommendations</h3>
                <div className="space-y-2">
                  {verdict.remediation.map((r, i) => {
                    const prColor = r.priority === 'high' ? '#EF4444' : r.priority === 'medium' ? '#F59E0B' : '#10B981';
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 rounded" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <span className="text-[10px] px-2 py-0.5 rounded shrink-0 mt-0.5" style={{ color: prColor, background: prColor + '15', fontFamily: fontFamily.mono }}>{r.priority}</span>
                        <div>
                          <span className="text-xs font-semibold text-[#8FA0B8] capitalize">{r.layer}</span>
                          <p className="text-xs text-[#64748B] mt-0.5">{r.action}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}
            </>)}
          </div>
        )}

        {/* Audit History */}
        {history.length > 0 && !result && (
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>Past Audits</h3>
            <div className="space-y-2">
              {history.map(a => {
                const qScore = a.quality_score;
                const verdictColor = qScore != null ? (qScore >= 70 ? '#10B981' : qScore >= 50 ? '#F59E0B' : '#EF4444') : (a.primary_failure_layer === 'none' ? '#10B981' : '#EF4444');
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-white/[0.02]" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}
                    onClick={() => { setUrl(a.target_url); }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: verdictColor }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-[#EDF1F7] block truncate">{a.target_url}</span>
                      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                        {qScore != null
                          ? `Score: ${qScore}/100 | ${a.confidence_level || '—'} | Pages: ${a.pages_crawled || '—'}`
                          : `${a.primary_failure_layer === 'none' ? 'All pass' : `Failure: ${a.primary_failure_layer}`} | Noise: ${a.noise_ratio}`
                        }
                      </span>
                    </div>
                    <span className="text-[10px] text-[#64748B] shrink-0" style={{ fontFamily: fontFamily.mono }}>
                      {new Date(a.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
      </div>
      </UpgradeCardsGate>
    </DashboardLayout>
  );
};

export default ForensicAuditPage;
