import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { Search, Shield, AlertTriangle, CheckCircle2, XCircle, Loader2, Layers, Filter, Brain, Clock, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
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
  return <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ color: c.color, background: c.color + '15', fontFamily: MONO }}>{c.label}</span>;
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
        <span className="text-xs font-semibold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{code}</span>
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
          <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>{title}</h3>
          <StatusBadge status={status} />
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
      </button>
      {open && <div className="mt-4 pt-4" style={{ borderTop: '1px solid #243140' }}>{children}</div>}
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
    apiClient.get('/forensic/ingestion-history').then(res => {
      setHistory(res.data?.audits || []);
    }).catch(() => {});
  }, []);

  const runAudit = async () => {
    if (!url.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiClient.post('/forensic/ingestion-audit', { url: url.trim() });
      setResult(res.data);
      // Refresh history
      apiClient.get('/forensic/ingestion-history').then(r => setHistory(r.data?.audits || [])).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.detail || 'Audit failed');
    } finally {
      setRunning(false);
    }
  };

  const ext = result?.extraction || {};
  const cln = result?.cleaning || {};
  const syn = result?.synthesis || {};
  const meta = result?.metadata || {};
  const verdict = result?.verdict || {};

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1000px]" style={{ fontFamily: BODY }} data-testid="forensic-audit-page">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>Forensic Ingestion Audit</h1>
          <p className="text-sm text-[#9FB0C3]">3-layer deterministic analysis of URL extraction, cleaning, and synthesis integrity.</p>
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
                placeholder="Enter URL to audit (e.g. thestrategysquad.com.au)"
                className="w-full h-11 pl-10 pr-4 rounded-lg text-sm outline-none"
                style={{ background: '#0F1720', border: '1px solid #243140', color: '#F4F7FA', fontFamily: BODY }}
                disabled={running}
                data-testid="audit-url-input"
              />
            </div>
            <button
              onClick={runAudit}
              disabled={running || !url.trim()}
              className="px-6 h-11 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50"
              style={{ background: '#FF6A00' }}
              data-testid="audit-run-btn"
            >
              {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Auditing...</> : <><Shield className="w-4 h-4" /> Run Audit</>}
            </button>
          </div>
          {error && <p className="text-xs text-[#EF4444] mt-2">{error}</p>}
        </Panel>

        {/* Loading */}
        {running && (
          <Panel className="text-center py-10">
            <Loader2 className="w-8 h-8 text-[#FF6A00] mx-auto mb-3 animate-spin" />
            <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>Running forensic audit...</p>
            <p className="text-xs text-[#64748B]">Fetching URL, cleaning DOM, analysing synthesis integrity.</p>
          </Panel>
        )}

        {/* Results */}
        {result && !running && (
          <div className="space-y-4">
            {/* Verdict Banner */}
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
                  <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>
                    {verdict.primary_failure_layer === 'none' ? 'All Layers Pass' : `Primary Failure: ${verdict.primary_failure_layer?.toUpperCase()}`}
                  </h2>
                </div>
                <span className="text-lg font-bold" style={{ color: verdict.confidence >= 0.8 ? '#10B981' : '#F59E0B', fontFamily: MONO }}>
                  {Math.round((verdict.confidence || 0) * 100)}%
                </span>
              </div>
              {verdict.secondary_failure_layer && (
                <p className="text-xs text-[#9FB0C3]">Secondary: {verdict.secondary_failure_layer}</p>
              )}
              {verdict.failure_codes?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {verdict.failure_codes.map((c, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#EF4444', background: '#EF444415', fontFamily: MONO }}>{c}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Layer 1: Extraction */}
            <CollapsibleSection title="Layer 1 — Extraction" icon={Layers} color="#3B82F6" status={ext.status} defaultOpen>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded" style={{ background: '#0F1720' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>HTTP Status</span>
                  <span className="text-lg font-bold" style={{ color: ext.http_status === 200 ? '#10B981' : '#EF4444', fontFamily: MONO }}>{ext.http_status}</span>
                </div>
                <div className="p-3 rounded" style={{ background: '#0F1720' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>HTML Length</span>
                  <span className="text-lg font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{(ext.raw_html_length || 0).toLocaleString()}</span>
                </div>
                <div className="p-3 rounded" style={{ background: '#0F1720' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Noise Ratio</span>
                  <span className="text-lg font-bold" style={{ color: ext.noise_ratio > 0.35 ? '#EF4444' : ext.noise_ratio > 0.2 ? '#F59E0B' : '#10B981', fontFamily: MONO }}>{ext.noise_ratio}</span>
                </div>
                <div className="p-3 rounded" style={{ background: '#0F1720' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Fetch Time</span>
                  <span className="text-lg font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{ext.fetch_time_ms}ms</span>
                </div>
              </div>
              <div className="space-y-2 text-xs text-[#9FB0C3]">
                <div className="flex justify-between"><span>Final URL</span><span className="text-[#F4F7FA] truncate ml-4" style={{ fontFamily: MONO }}>{ext.final_url}</span></div>
                <div className="flex justify-between"><span>Canonical URL</span><span className="text-[#64748B]" style={{ fontFamily: MONO }}>{ext.canonical_url || 'Not set'}</span></div>
                <div className="flex justify-between"><span>Main Content</span><span style={{ color: ext.main_content_present ? '#10B981' : '#EF4444' }}>{ext.main_content_present ? 'Detected' : 'Not found'}</span></div>
                <div className="flex justify-between"><span>Structured Data</span><span style={{ color: ext.has_structured_data ? '#10B981' : '#64748B' }}>{ext.has_structured_data ? 'Found' : 'None'}</span></div>
                <div className="flex justify-between"><span>Redirects</span><span style={{ fontFamily: MONO }}>{ext.redirect_chain?.length || 0}</span></div>
              </div>
              {ext.failure_codes?.length > 0 && (
                <div className="mt-3 space-y-1">{ext.failure_codes.map((c, i) => <FailureCode key={i} code={c} />)}</div>
              )}
            </CollapsibleSection>

            {/* Layer 2: Cleaning */}
            <CollapsibleSection title="Layer 2 — Semantic Cleaning" icon={Filter} color="#10B981" status={cln.status}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded" style={{ background: '#0F1720' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Unique Sentences</span>
                  <span className="text-lg font-bold" style={{ color: cln.unique_sentence_ratio > 0.7 ? '#10B981' : '#F59E0B', fontFamily: MONO }}>{Math.round((cln.unique_sentence_ratio || 0) * 100)}%</span>
                </div>
                <div className="p-3 rounded" style={{ background: '#0F1720' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Core Weight</span>
                  <span className="text-lg font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{cln.core_content_weight}</span>
                </div>
                <div className="p-3 rounded" style={{ background: '#0F1720' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Nav Removed</span>
                  <span style={{ color: cln.nav_removed ? '#10B981' : '#64748B' }}>{cln.nav_removed ? 'Yes' : 'No'}</span>
                </div>
                <div className="p-3 rounded" style={{ background: '#0F1720' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Footer Removed</span>
                  <span style={{ color: cln.footer_removed ? '#10B981' : '#64748B' }}>{cln.footer_removed ? 'Yes' : 'No'}</span>
                </div>
              </div>
              {cln.sections?.length > 0 && (
                <div className="mb-3">
                  <span className="text-[10px] text-[#64748B] block mb-2" style={{ fontFamily: MONO }}>Detected Sections</span>
                  <div className="flex flex-wrap gap-2">
                    {cln.sections.map((s, i) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded" style={{ background: '#0F1720', color: '#9FB0C3', fontFamily: MONO }}>
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
                <div className="p-3 rounded" style={{ background: '#0F1720' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Hallucinations</span>
                  <span className="text-lg font-bold" style={{ color: (syn.hallucinations?.length || 0) > 0 ? '#EF4444' : '#10B981', fontFamily: MONO }}>{syn.hallucinations?.length || 0}</span>
                </div>
                <div className="p-3 rounded" style={{ background: '#0F1720' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Lost Signals</span>
                  <span className="text-lg font-bold" style={{ color: (syn.lost_signals?.length || 0) > 0 ? '#F59E0B' : '#10B981', fontFamily: MONO }}>{syn.lost_signals?.length || 0}</span>
                </div>
              </div>
              {syn.hallucinations?.length > 0 && (
                <div className="mb-3">
                  <span className="text-[10px] font-semibold text-[#EF4444] block mb-2" style={{ fontFamily: MONO }}>HALLUCINATIONS DETECTED</span>
                  <div className="space-y-1">
                    {syn.hallucinations.map((h, i) => (
                      <div key={i} className="p-2 rounded text-xs" style={{ background: '#EF444408', border: '1px solid #EF444415' }}>
                        <span className="text-[#F4F7FA] font-semibold">{h.claim}</span>
                        <span className="text-[#64748B] ml-2">({h.type})</span>
                        <p className="text-[10px] text-[#64748B] mt-0.5">{h.evidence}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {syn.lost_signals?.length > 0 && (
                <div className="mb-3">
                  <span className="text-[10px] font-semibold text-[#F59E0B] block mb-2" style={{ fontFamily: MONO }}>LOST SIGNALS</span>
                  <div className="space-y-1">
                    {syn.lost_signals.map((s, i) => (
                      <div key={i} className="p-2 rounded text-xs" style={{ background: '#F59E0B08', border: '1px solid #F59E0B15' }}>
                        <span className="text-[#F4F7FA] font-semibold">{s.type}: {s.value}</span>
                        <p className="text-[10px] text-[#64748B] mt-0.5">{s.evidence}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {syn.prompt_inference_flags?.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-[#F59E0B] block mb-2" style={{ fontFamily: MONO }}>PROMPT INFERENCE FLAGS</span>
                  <div className="space-y-1">
                    {syn.prompt_inference_flags.map((f, i) => (
                      <div key={i} className="p-2 rounded text-xs" style={{ background: '#F59E0B08', border: '1px solid #F59E0B15' }}>
                        <span className="text-[#F4F7FA]">"{f.phrase}"</span>
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
              <div className="space-y-2 text-xs text-[#9FB0C3]">
                <div className="flex justify-between"><span>Copyright Year</span><span style={{ color: meta.copyright_year && meta.copyright_year < 2025 ? '#F59E0B' : '#10B981', fontFamily: MONO }}>{meta.copyright_year || 'Not found'}</span></div>
                <div className="flex justify-between"><span>Latest Blog Date</span><span style={{ fontFamily: MONO }}>{meta.latest_blog_date || 'Not found'}</span></div>
                <div className="flex justify-between"><span>Freshness</span><span style={{ color: meta.freshness_status === 'current' ? '#10B981' : meta.freshness_status === 'stale' ? '#EF4444' : '#F59E0B', fontFamily: MONO }}>{meta.freshness_status}</span></div>
              </div>
              {meta.failure_codes?.length > 0 && (
                <div className="mt-3 space-y-1">{meta.failure_codes.map((c, i) => <FailureCode key={i} code={c} />)}</div>
              )}
            </CollapsibleSection>

            {/* Remediation */}
            {verdict.remediation?.length > 0 && (
              <Panel>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: HEAD }}>Remediation Recommendations</h3>
                <div className="space-y-2">
                  {verdict.remediation.map((r, i) => {
                    const prColor = r.priority === 'high' ? '#EF4444' : r.priority === 'medium' ? '#F59E0B' : '#10B981';
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 rounded" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                        <span className="text-[10px] px-2 py-0.5 rounded shrink-0 mt-0.5" style={{ color: prColor, background: prColor + '15', fontFamily: MONO }}>{r.priority}</span>
                        <div>
                          <span className="text-xs font-semibold text-[#9FB0C3] capitalize">{r.layer}</span>
                          <p className="text-xs text-[#64748B] mt-0.5">{r.action}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}
          </div>
        )}

        {/* Audit History */}
        {history.length > 0 && !result && (
          <Panel>
            <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: HEAD }}>Past Audits</h3>
            <div className="space-y-2">
              {history.map(a => {
                const verdictColor = a.primary_failure_layer === 'none' ? '#10B981' : '#EF4444';
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-white/[0.02]" style={{ background: '#0F1720', border: '1px solid #243140' }}
                    onClick={() => { setUrl(a.target_url); }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: verdictColor }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-[#F4F7FA] block truncate">{a.target_url}</span>
                      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>
                        {a.primary_failure_layer === 'none' ? 'All pass' : `Failure: ${a.primary_failure_layer}`} | Noise: {a.noise_ratio} | Confidence: {Math.round((a.confidence_score || 0) * 100)}%
                      </span>
                    </div>
                    <span className="text-[10px] text-[#64748B] shrink-0" style={{ fontFamily: MONO }}>
                      {new Date(a.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ForensicAuditPage;
