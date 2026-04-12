import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import UpgradeCardsGate from '../components/UpgradeCardsGate';
import { apiClient } from '../lib/api';
import { Search, Shield, AlertTriangle, CheckCircle2, Loader2, Target, Eye, MapPin, Star, TrendingUp, BarChart3, Lock, ChevronDown, ChevronUp, ExternalLink, Zap } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const TIER_COLORS = { major: '#EF4444', moderate: '#F59E0B', structural: '#7C3AED' };
const TIER_LABELS = { major: 'Critical', moderate: 'Significant', structural: 'Structural' };

const DSEEPage = () => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [sections, setSections] = useState({ asym: true, sdd: false, conf: false, review: false });

  const toggle = (k) => setSections(p => ({ ...p, [k]: !p[k] }));

  const runScan = async () => {
    if (!url.trim()) return;
    setRunning(true); setError(null); setResult(null);
    try {
      const res = await apiClient.post('/dsee/scan', { url: url.trim(), business_name: name || undefined, location: location || undefined, public_mode: true }, { timeout: 90000 });
      setResult(res.data);
    } catch (err) { setError(err.response?.data?.detail || err.message || 'Scan failed — try again'); }
    finally { setRunning(false); }
  };

  const r = result;
  const conf = r?.confidence || {};
  const sdd = r?.search_dominance_density || {};

  return (
    <DashboardLayout>
      <UpgradeCardsGate requiredTier="starter" featureName="Exposure Scan">
      <div className="space-y-4 max-w-[900px]" style={{ fontFamily: fontFamily.body }} data-testid="dsee-page">
        <div>
          <h1 className="text-2xl font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display, WebkitTextStroke: '0.2px #EDF1F7' }}>Structural Exposure Analysis</h1>
          <p className="text-sm text-[#8FA0B8] mb-3">
            Deterministic competitive intelligence — no financial projections. Analyses your digital structure, competitors and strategic vulnerabilities from public data.
          </p>
          <div className="p-3 rounded-lg" style={{ background: 'rgba(232,93,0,0.04)', border: '1px solid rgba(232,93,0,0.12)' }}>
            <p className="text-[10px]" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
              Enter your business website URL to run a structural scan. Example: <span style={{ color: '#E85D00' }}>yourcompany.com</span>
              &nbsp;•&nbsp; Results include: business classification, competitor mapping, digital density, and strategic exposure points.
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
          <label className="text-xs font-semibold mb-2 block" style={{ color: '#8FA0B8', fontFamily: fontFamily.mono }}>
            Website URL <span style={{ color: '#EF4444' }}>*</span> <span style={{ color: '#4A5568' }}>(required)</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && runScan()}
              placeholder="yourwebsite.com.au *"
              disabled={running}
              className="flex-1 h-11 px-4 rounded-xl text-sm outline-none"
              style={{ background: 'var(--biqc-bg-input)', border: `1px solid ${!url.trim() && error ? '#EF4444' : 'var(--biqc-border)'}`, color: 'var(--biqc-text)' }}
              data-testid="dsee-url" />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Business name (optional)" disabled={running}
              className="sm:w-48 h-11 px-4 rounded-xl text-sm outline-none" style={{ background: 'var(--biqc-bg-input)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }} />
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City (optional)" disabled={running}
              className="sm:w-32 h-11 px-4 rounded-xl text-sm outline-none" style={{ background: 'var(--biqc-bg-input)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }} />
            <button onClick={runScan} disabled={running || !url.trim()} className="h-11 px-6 rounded-xl text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50 shrink-0" style={{ background: '#E85D00' }} data-testid="dsee-run">
              {running ? <><Loader2 className="w-4 h-4 animate-spin" />Scanning...</> : <><Eye className="w-4 h-4" />Scan</>}
            </button>
          </div>
          {error && <p className="text-xs text-[#EF4444] mt-2">{error}</p>}
        </div>

        {running && (
          <div className="rounded-2xl p-8" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 text-[#E85D00] animate-spin shrink-0" />
              <p className="text-sm text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Running structural exposure analysis…</p>
            </div>
            {/* Progress stages */}
            {[
              { label: 'Resolving domain & crawling URL', done: true },
              { label: 'Classifying business structure', done: true },
              { label: 'Mapping competitors via SERP', done: false },
              { label: 'Computing digital density & exposure', done: false },
              { label: 'Generating strategic report', done: false },
            ].map((stage, i) => (
              <div key={i} className="flex items-center gap-2 mt-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${stage.done ? 'bg-green-500' : 'bg-[#E85D00] animate-pulse'}`} />
                <p className="text-xs" style={{ color: stage.done ? '#10B981' : '#8FA0B8', fontFamily: fontFamily.mono }}>{stage.label}</p>
              </div>
            ))}
          </div>
        )}

        {r && !running && <>
          {/* ═══ STRUCTURE + CONFIDENCE BANNER ═══ */}
          <div className="rounded-2xl p-5" style={{ background: '#E85D0008', border: '1px solid #E85D0025' }} data-testid="dsee-verdict">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#E85D0015', color: '#E85D00', fontFamily: fontFamily.mono }}>{r.structure?.structure?.replace(/([A-Z])/g, ' $1').trim()}</span>
                  {r.structure?.national_scope && <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#3B82F615', color: '#3B82F6', fontFamily: fontFamily.mono }}>National</span>}
                  {r.domain?.fallback_used && <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#F59E0B15', color: '#F59E0B', fontFamily: fontFamily.mono }}>SERP Fallback</span>}
                </div>
                <h2 className="text-xl font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>{r.business_name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  {r.location && <span className="text-xs text-[#8FA0B8] flex items-center gap-1"><MapPin className="w-3 h-3" />{r.location}</span>}
                  <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{r.domain?.resolved_domain}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold block" style={{ fontFamily: fontFamily.mono, color: conf.confidence_overall >= 0.5 ? '#F59E0B' : '#EF4444' }}>{Math.round((conf.confidence_overall || 0) * 100)}%</span>
                <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>confidence{conf.confidence_cap_applied ? ' (capped)' : ''}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              <div className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Asymmetries</span>
                <span className="text-lg font-bold" style={{ fontFamily: fontFamily.mono, color: r.asymmetry_count >= 3 ? '#EF4444' : '#F59E0B' }}>{r.asymmetry_count}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Competitors</span>
                <span className="text-lg font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{r.competitor_count}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Reviews</span>
                <span className="text-lg font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{r.reviews?.google_reviews || 0}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Search</span>
                <span className="text-lg font-bold" style={{ fontFamily: fontFamily.mono, color: r.search?.dominance === 'present' ? '#10B981' : '#EF4444' }}>{r.search?.dominance}</span>
              </div>
            </div>
          </div>

          {/* ═══ ASYMMETRIES ═══ */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }} data-testid="dsee-asymmetries">
            <button onClick={() => toggle('asym')} className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                <span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Structural Exposures ({r.asymmetry_count})</span>
              </div>
              {sections.asym ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
            </button>
            {sections.asym && (
              <div className="px-4 pb-4 space-y-3">
                {(r.asymmetries || []).map((a, i) => {
                  const tc = TIER_COLORS[a.tier] || '#F59E0B';
                  return (
                    <div key={i} className="rounded-xl p-4" style={{ background: tc + '06', border: `1px solid ${tc}20` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ color: tc, background: tc + '15', fontFamily: fontFamily.mono }}>{TIER_LABELS[a.tier] || a.tier}</span>
                        <span className="text-xs font-semibold" style={{ color: tc }}>{a.structural_implication}</span>
                        <span className="text-[10px] ml-auto" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{Math.round((a.confidence || 0) * 100)}%</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-2 rounded" style={{ background: 'var(--biqc-bg)' }}>
                          <span className="text-[10px] text-[#64748B] block mb-0.5" style={{ fontFamily: fontFamily.mono }}>You</span>
                          <span className="text-[#8FA0B8]">{a.subject_metric}</span>
                        </div>
                        <div className="p-2 rounded" style={{ background: 'var(--biqc-bg)' }}>
                          <span className="text-[10px] text-[#64748B] block mb-0.5" style={{ fontFamily: fontFamily.mono }}>Competitor</span>
                          <span className="text-[#EDF1F7]">{a.competitor_metric}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ fontFamily: fontFamily.mono }}>
                        <span className="text-[#64748B]">Ratio: <strong className="text-[#EDF1F7]">{a.differential_ratio}</strong></span>
                        <span className="text-[#64748B]">Source: {a.metric_source}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ═══ SEARCH DOMINANCE DENSITY ═══ */}
          {sdd.sdd_score && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }} data-testid="dsee-sdd">
              <button onClick={() => toggle('sdd')} className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
                  <span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Search Dominance Density</span>
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#3B82F6', background: '#3B82F615', fontFamily: fontFamily.mono }}>SDD {Math.round(sdd.sdd_score.sds_score * 100)}/100</span>
                </div>
                {sections.sdd ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
              </button>
              {sections.sdd && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(sdd.sdd_score?.ratios || {}).map(([k, v]) => (
                      <div key={k} className="p-3 rounded-lg text-center" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>{k.replace(/_/g, ' ')}</span>
                        <span className="text-lg font-bold" style={{ fontFamily: fontFamily.mono, color: v < 0.5 ? '#EF4444' : v < 1 ? '#F59E0B' : '#10B981' }}>{v}x</span>
                      </div>
                    ))}
                  </div>
                  {sdd.normalization && (
                    <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Normalization</span>
                      <span className="text-xs text-[#8FA0B8]">Volume factor: {sdd.normalization.volume_adjustment_factor} | Pages: {sdd.normalization.pages_crawled_subject} vs avg {sdd.normalization.pages_crawled_competitor_avg} | Cap: {sdd.normalization.per_page_cap}/page | Boilerplate: suppressed</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ CONFIDENCE BREAKDOWN ═══ */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }} data-testid="dsee-confidence">
            <button onClick={() => toggle('conf')} className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#10B981]" />
                <span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Confidence Decomposition</span>
              </div>
              {sections.conf ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
            </button>
            {sections.conf && (
              <div className="px-4 pb-4 space-y-2">
                {Object.entries(conf.confidence_components || {}).map(([k, v]) => (
                  <div key={k}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs text-[#8FA0B8] capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-semibold" style={{ fontFamily: fontFamily.mono, color: v >= 0.7 ? '#10B981' : v >= 0.4 ? '#F59E0B' : '#EF4444' }}>{Math.round(v * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'rgba(140,170,210,0.15)' }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${v * 100}%`, background: v >= 0.7 ? '#10B981' : v >= 0.4 ? '#F59E0B' : '#EF4444' }} />
                    </div>
                  </div>
                ))}
                {conf.penalties_applied && Object.keys(conf.penalties_applied).length > 0 && (
                  <div className="mt-2 p-2 rounded" style={{ background: '#EF444408', border: '1px solid #EF444415' }}>
                    <span className="text-[10px] text-[#EF4444] block mb-1" style={{ fontFamily: fontFamily.mono }}>Penalties Applied ({conf.penalty_total})</span>
                    {Object.entries(conf.penalties_applied).map(([k, v]) => (
                      <span key={k} className="text-[10px] text-[#8FA0B8] block">{k.replace(/_/g, ' ')}: {v}</span>
                    ))}
                  </div>
                )}
                <div className="p-2 rounded" style={{ background: 'var(--biqc-bg)' }}>
                  <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Scope: {conf.scope_coverage?.pages_crawled}/{conf.scope_coverage?.estimated_total_pages} pages ({Math.round((conf.scope_coverage?.coverage_ratio || 0) * 100)}%) | Fallback: {conf.fallback_used ? 'yes' : 'no'} | Cap: {conf.confidence_cap_applied ? '70% applied' : 'not applied'}</span>
                </div>
              </div>
            )}
          </div>

          {/* ═══ COMPETITORS ═══ */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <span className="text-[10px] text-[#64748B] block mb-2" style={{ fontFamily: fontFamily.mono }}>Competitors Identified</span>
            {(r.competitors || []).map((c, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5" style={{ borderBottom: i < r.competitors.length - 1 ? '1px solid rgba(140,170,210,0.15)' : 'none' }}>
                <span className="text-xs text-[#EDF1F7]">{c.name}</span>
                <span className="text-[10px] text-[#64748B] ml-auto" style={{ fontFamily: fontFamily.mono }}>{c.domain}</span>
                {c.service_match && <span className="text-[9px] px-1 rounded" style={{ color: '#10B981', background: '#10B98115' }}>svc</span>}
                {c.geo_match && <span className="text-[9px] px-1 rounded" style={{ color: '#3B82F6', background: '#3B82F615' }}>geo</span>}
              </div>
            ))}
          </div>

          {/* ═══ PROJECTION LOCK ═══ */}
          {r.projection_lock && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: r.projection_lock.clean ? '#10B98108' : '#EF444408', border: `1px solid ${r.projection_lock.clean ? '#10B98120' : '#EF444420'}` }}>
              <Lock className="w-3.5 h-3.5" style={{ color: r.projection_lock.clean ? '#10B981' : '#EF4444' }} />
              <span className="text-[10px]" style={{ color: r.projection_lock.clean ? '#10B981' : '#EF4444', fontFamily: fontFamily.mono }}>
                {r.projection_lock.clean ? 'No financial projections detected' : `${r.projection_lock.violation_count} projection violations`}
              </span>
            </div>
          )}

          <span className="text-[10px] text-[#64748B] block text-center" style={{ fontFamily: fontFamily.mono }}>{r.execution_time_ms}ms | scan:{r.scan_id}</span>
        </>}
      </div>
      </UpgradeCardsGate>
    </DashboardLayout>
  );
};

export default DSEEPage;
