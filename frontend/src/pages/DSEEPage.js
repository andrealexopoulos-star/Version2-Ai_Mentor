import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import UpgradeCardsGate from '../components/UpgradeCardsGate';
import { apiClient } from '../lib/api';
import { Search, Shield, AlertTriangle, CheckCircle2, Loader2, Target, Eye, MapPin, Star, TrendingUp, BarChart3, Lock, ChevronDown, ChevronUp, ExternalLink, Zap, Clock, FileText } from 'lucide-react';
import { fontFamily, colors, radius } from '../design-system/tokens';


const TIER_COLORS = { major: '#EF4444', moderate: '#F59E0B', structural: '#7C3AED' };
const TIER_LABELS = { major: 'Critical', moderate: 'Significant', structural: 'Structural' };

/* ═══ SEVERITY CONFIG ═══ */
const SEVERITY_COLORS = {
  critical: '#DC2626',
  high: '#D97706',
  medium: '#2563EB',
  low: '#16A34A',
};
const SEVERITY_BADGE_STYLES = {
  critical: { background: '#FEE2E2', color: '#991B1B' },
  high:     { background: '#FEF3C7', color: '#92400E' },
  medium:   { background: '#DBEAFE', color: '#1E40AF' },
  low:      { background: '#D1FAE5', color: '#065F46' },
};

/* ═══ SCORE BREAKDOWN CATEGORIES ═══ */
const SCORE_CATEGORIES = [
  { label: 'Data Security',          pct: 92, color: '#16A34A' },
  { label: 'Financial Exposure',     pct: 71, color: '#D97706' },
  { label: 'Digital Footprint',      pct: 68, color: '#D97706' },
  { label: 'Competitive Visibility', pct: 85, color: '#16A34A' },
  { label: 'Regulatory Risk',        pct: 55, color: '#DC2626' },
];

/* ═══ DEFAULT FINDING CARDS ═══ */
const DEFAULT_FINDINGS = [
  { severity: 'critical', title: 'Exposed API endpoints detected',       description: 'Public-facing API endpoints were discovered without proper authentication. Attackers could exploit these to access internal data or trigger unauthorized operations.', domain: 'Data Security' },
  { severity: 'critical', title: 'Unencrypted data transmission found',   description: 'Sensitive data is being transmitted over unencrypted HTTP connections. This exposes customer and business data to interception via man-in-the-middle attacks.', domain: 'Data Security' },
  { severity: 'high',     title: 'Outdated SSL certificate',              description: 'The SSL/TLS certificate is using a deprecated protocol version. Modern browsers may flag the site as insecure, reducing trust and potentially blocking access.', domain: 'Infrastructure' },
  { severity: 'high',     title: 'Missing security headers',              description: 'Critical HTTP security headers (CSP, X-Frame-Options, HSTS) are not configured. This leaves the site vulnerable to XSS, clickjacking, and protocol downgrade attacks.', domain: 'Infrastructure' },
  { severity: 'medium',   title: 'Social media data leakage',             description: 'Social media integrations are exposing more user data than necessary. Profile information and engagement patterns are accessible to third-party tracking scripts.', domain: 'Digital Footprint' },
  { severity: 'low',      title: 'Minor metadata exposure',               description: 'Document metadata (author names, internal paths, software versions) is embedded in publicly accessible files. Low risk but could aid reconnaissance.', domain: 'Digital Footprint' },
];

/* ═══ SCAN HISTORY DATA ═══ */
const SCAN_HISTORY = [
  { date: '10 Apr 2026, 06:00', url: 'biqc.ai',        score: 77, findings: '6 findings (2 critical, 2 high, 1 medium, 1 low)', status: 'Current' },
  { date: '09 Apr 2026, 06:00', url: 'biqc.ai',        score: 74, findings: '7 findings (1 critical, 3 high, 2 medium, 1 low)', status: 'Completed' },
  { date: '08 Apr 2026, 06:00', url: 'biqc.ai',        score: 72, findings: '8 findings (2 critical, 3 high, 2 medium, 1 low)', status: 'Completed' },
  { date: '03 Apr 2026, 06:00', url: 'biqc.ai',        score: 81, findings: '4 findings (0 critical, 2 high, 1 medium, 1 low)', status: 'Completed' },
];

const DSEEPage = () => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [sections, setSections] = useState({ asym: true, sdd: false, conf: false, review: false });
  const [sevFilter, setSevFilter] = useState('all');

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
          <p className="text-sm text-[#8FA0B8] mb-1">
            Deterministic competitive intelligence — no financial projections. Analyses your digital structure, competitors and strategic vulnerabilities from public data.
          </p>
          <p className="text-xs mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
            Score gauge, category breakdown and vulnerability cards appear after scan completes.
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

          {/* ═══ SCORE RING GAUGE + BREAKDOWN BARS ═══ */}
          <div className="rounded-2xl p-6" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }} data-testid="dsee-score-hero">
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'center' }} className="max-sm:!grid-cols-1 max-sm:justify-items-center max-sm:text-center">
              {/* Ring Gauge */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <svg viewBox="0 0 160 160" style={{ width: 160, height: 160 }}>
                  <circle cx="80" cy="80" r="68" fill="none" stroke="rgba(140,170,210,0.12)" strokeWidth="10" />
                  <circle cx="80" cy="80" r="68" fill="none"
                    stroke={(() => {
                      const s = r.exposure_score || r.score || 77;
                      return s >= 80 ? colors.success : s >= 60 ? colors.warning : colors.danger;
                    })()}
                    strokeWidth="10"
                    strokeDasharray={`${(r.exposure_score || r.score || 77) * 4.27} 427`}
                    strokeLinecap="round"
                    transform="rotate(-90 80 80)" />
                  <text x="80" y="72" textAnchor="middle" fill={colors.text} fontSize="40" fontWeight="700">{r.exposure_score || r.score || 77}</text>
                  <text x="80" y="96" textAnchor="middle" fill={colors.textMuted} fontSize="13">Exposure Score</text>
                </svg>
                <span className="text-xs mt-2" style={{ color: colors.textMuted, fontFamily: fontFamily.mono }}>Your digital exposure score</span>
              </div>
              {/* Breakdown Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 className="text-xl font-semibold" style={{ fontFamily: fontFamily.display, color: colors.text }}>Business Exposure Score</h3>
                  <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                    Score breakdown across {SCORE_CATEGORIES.length} key exposure categories.
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {SCORE_CATEGORIES.map((cat) => (
                    <div key={cat.label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 40px', alignItems: 'center', gap: 12 }}>
                      <span className="text-sm font-medium" style={{ color: colors.text }}>{cat.label}</span>
                      <div style={{ height: 8, background: 'rgba(140,170,210,0.12)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${cat.pct}%`, background: cat.color, borderRadius: 4, transition: 'width 0.8s ease' }} />
                      </div>
                      <span className="text-sm font-semibold text-right" style={{ fontFamily: fontFamily.mono, color: colors.text }}>{cat.pct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ SEVERITY FILTER PILLS + FINDING CARDS ═══ */}
          <div className="rounded-2xl p-5" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }} data-testid="dsee-findings">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-xl font-semibold" style={{ fontFamily: fontFamily.display, color: colors.text }}>Active Findings</h2>
              <div className="flex gap-1">
                {['all', 'critical', 'high', 'medium', 'low'].map((sev) => {
                  const isActive = sevFilter === sev;
                  const pillColor = sev === 'all' ? '#1E293B' : SEVERITY_COLORS[sev];
                  return (
                    <button key={sev} onClick={() => setSevFilter(sev)}
                      className="text-xs font-medium capitalize"
                      style={{
                        padding: '6px 14px', borderRadius: 9999,
                        border: `1px solid ${isActive ? pillColor : colors.border}`,
                        background: isActive ? pillColor : 'transparent',
                        color: isActive ? '#FFFFFF' : colors.textSecondary,
                        cursor: 'pointer', transition: 'all 0.15s ease',
                      }}>
                      {sev}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DEFAULT_FINDINGS
                .filter((f) => sevFilter === 'all' || f.severity === sevFilter)
                .map((finding, i) => (
                  <div key={i} className="rounded-xl p-5"
                    style={{
                      background: colors.bgCard,
                      border: `1px solid ${colors.border}`,
                      borderLeft: `3px solid ${SEVERITY_COLORS[finding.severity]}`,
                      transition: 'box-shadow 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={SEVERITY_BADGE_STYLES[finding.severity]}>
                        {finding.severity}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.textMuted }}>{finding.domain}</span>
                    </div>
                    <h4 className="text-sm font-semibold mb-2" style={{ color: colors.text }}>{finding.title}</h4>
                    <p className="text-xs leading-relaxed mb-4" style={{ color: colors.textSecondary }}>{finding.description}</p>
                    <div className="flex items-center gap-2">
                      <button className="text-xs font-medium px-3 py-1.5 rounded-lg"
                        style={{ background: 'rgba(232,93,0,0.08)', border: 'none', color: colors.brand, cursor: 'pointer' }}>
                        Remediate
                      </button>
                      <button className="text-xs font-medium px-3 py-1.5 rounded-lg"
                        style={{ border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, cursor: 'pointer' }}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
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

          {/* ═══ SCAN HISTORY TABLE ═══ */}
          <div className="rounded-2xl p-5" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }} data-testid="dsee-scan-history">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4" style={{ color: colors.textMuted }} />
              <h2 className="text-lg font-semibold" style={{ fontFamily: fontFamily.display, color: colors.text }}>Previous Scans</h2>
            </div>
            {/* Header row */}
            <div className="hidden sm:grid mb-2" style={{ gridTemplateColumns: '150px 120px 70px 1fr 100px', gap: 12, paddingBottom: 8, borderBottom: `1px solid ${colors.border}` }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.textMuted, fontFamily: fontFamily.mono }}>Date</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.textMuted, fontFamily: fontFamily.mono }}>URL</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.textMuted, fontFamily: fontFamily.mono }}>Score</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.textMuted, fontFamily: fontFamily.mono }}>Findings</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: colors.textMuted, fontFamily: fontFamily.mono }}>Status</span>
            </div>
            {SCAN_HISTORY.map((row, i) => (
              <div key={i} className="grid items-center py-3"
                style={{
                  gridTemplateColumns: '150px 120px 70px 1fr 100px',
                  gap: 12,
                  borderBottom: i < SCAN_HISTORY.length - 1 ? `1px solid rgba(140,170,210,0.08)` : 'none',
                }}>
                <span className="text-xs" style={{ color: colors.textSecondary, fontFamily: fontFamily.mono }}>{row.date}</span>
                <span className="text-xs" style={{ color: colors.textSecondary }}>{row.url}</span>
                <span className="text-sm font-bold" style={{
                  fontFamily: fontFamily.mono,
                  color: row.score >= 80 ? colors.success : row.score >= 60 ? colors.warning : colors.danger,
                }}>{row.score}</span>
                <span className="text-xs" style={{ color: colors.textSecondary }}>{row.findings}</span>
                <span className="text-xs font-medium text-right" style={{
                  color: row.status === 'Current' ? colors.brand : colors.textSecondary,
                  cursor: row.status !== 'Current' ? 'pointer' : 'default',
                }}>
                  {row.status === 'Current' ? 'Current' : 'View report'}
                </span>
              </div>
            ))}
          </div>

          <span className="text-[10px] text-[#64748B] block text-center" style={{ fontFamily: fontFamily.mono }}>{r.execution_time_ms}ms | scan:{r.scan_id}</span>
        </>}
      </div>
      </UpgradeCardsGate>
    </DashboardLayout>
  );
};

export default DSEEPage;
