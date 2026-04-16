import React, { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageLoadingState } from '../components/PageStateComponents';
import { trackEvent } from '../lib/analytics';
import {
  TrendingUp, TrendingDown, Globe, BarChart3, Target, ArrowRight, Loader2,
  RefreshCw, Award, Users, Info, Plus, X, Search, ChevronDown, CheckCircle2,
  AlertTriangle, Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ── Pillar definitions — with descriptions ────────────────────────────────────
const PILLARS = [
  {
    key: 'website', label: 'Website Presence', icon: Globe,
    desc: 'Measures how visible and accessible your website is — page load speed, mobile-friendliness, domain authority and crawlability.',
    action: 'Improve: Ensure your site loads in under 2 seconds and is mobile-optimised.',
  },
  {
    key: 'social', label: 'Social Engagement', icon: Users,
    desc: 'Tracks how actively your audience interacts with your social media — likes, shares, comments, follower growth and post frequency.',
    action: 'Improve: Post 3x per week consistently. Respond to all comments within 24 hours.',
  },
  {
    key: 'reviews', label: 'Review Reputation', icon: Award,
    desc: 'Scores your online reputation across Google, Facebook and industry directories — average rating, review volume and recency.',
    action: 'Improve: Ask every satisfied client for a Google review within 48 hours of project completion.',
  },
  {
    key: 'content', label: 'Content Authority', icon: BarChart3,
    desc: 'Assesses the quality and volume of your published content — blog posts, case studies, thought leadership and topic relevance.',
    action: 'Improve: Publish 2 blog posts per month focused on your core service keywords.',
  },
  {
    key: 'seo', label: 'SEO Visibility', icon: Target,
    desc: 'Measures how easily customers find your business via search engines — keyword rankings, backlinks and local SEO optimisation.',
    action: 'Improve: Claim and optimise your Google Business Profile. Target 3-5 local keywords.',
  },
];

const BENCHMARK_KEY_MAP = {
  website: 'digital_presence',
  social: 'social_engagement',
  reviews: 'brand_visibility',
  content: 'content_maturity',
  seo: 'ai_citation_share',
};

const asNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizePossiblyPercent = (value) => {
  const num = asNumber(value);
  if (num == null) return null;
  if (num <= 0) return null;
  if (num <= 1) return Math.round(num * 100);
  return Math.round(Math.min(100, num));
};

const coerceScore = (container, keys = []) => {
  if (!container || typeof container !== 'object') return null;
  for (const key of keys) {
    if (container[key] != null) {
      const normalized = normalizePossiblyPercent(container[key]);
      if (normalized != null) return normalized;
    }
  }
  return null;
};

const parseJsonSafe = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeCmoBundleScores = (bundle) => {
  if (!bundle || typeof bundle !== 'object') return null;
  const website = coerceScore(bundle.website_health, ['score', 'overall_score', 'health_score', 'visibility_score']);
  const social = coerceScore(bundle.social_media_analysis, ['score', 'overall_score', 'engagement_score']);
  const reviews = coerceScore(bundle.website_health, ['review_score', 'reputation_score', 'trust_score']);
  const content = coerceScore(bundle.paid_media_analysis, ['content_score', 'quality_score', 'score']);
  const seo = coerceScore(bundle.seo_analysis, ['score', 'visibility_score', 'ranking_score']);
  const derivedAverage = [website, social, reviews, content, seo]
    .filter((v) => typeof v === 'number');
  const overall = coerceScore(bundle, ['overall_score', 'score']) ?? (
    derivedAverage.length
      ? derivedAverage.reduce((sum, v) => sum + v, 0) / derivedAverage.length
      : null
  );
  return {
    overall: typeof overall === 'number' ? Math.round(overall) : null,
    pillars: { website, social, reviews, content, seo },
    competitors: Array.isArray(bundle.competitors) ? bundle.competitors : [],
  };
};

const normalizeBenchmarkScores = (scores = {}) => ({
  website: scores.digital_presence != null ? Math.round(Number(scores.digital_presence) * 100) : null,
  social: scores.social_engagement != null ? Math.round(Number(scores.social_engagement) * 100) : null,
  reviews: scores.brand_visibility != null ? Math.round(Number(scores.brand_visibility) * 100) : null,
  content: scores.content_maturity != null ? Math.round(Number(scores.content_maturity) * 100) : null,
  seo: scores.ai_citation_share != null ? Math.round(Number(scores.ai_citation_share) * 100) : null,
});

// ── Tooltip ───────────────────────────────────────────────────────────────────
const Tooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs leading-snug z-50 w-56"
          style={{ background: 'var(--surface-2, #1E2D3D)', color: 'var(--ink-display)', border: '1px solid var(--border)', fontFamily: 'var(--font-ui)', boxShadow: 'var(--elev-2)' }}>
          {text}
        </span>
      )}
    </span>
  );
};

// ── Score gauge ───────────────────────────────────────────────────────────────
const ScoreGauge = ({ score, label, color, isReal }) => {
  const pct = isReal && score != null ? Math.min((score / 100) * 100, 100) : 0;
  const radius = 54; const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        {isReal && score != null && (
          <circle cx="65" cy="65" r={radius} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" transform="rotate(-90 65 65)"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
        )}
        {isReal && score != null
          ? <>
              <text x="65" y="58" textAnchor="middle" style={{ fill: 'var(--ink-display)', fontSize: '28px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{score}</text>
              <text x="65" y="78" textAnchor="middle" style={{ fill: 'var(--ink-muted)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>/100</text>
            </>
          : <text x="65" y="68" textAnchor="middle" style={{ fill: 'var(--ink-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>No data</text>
        }
      </svg>
      {label && <p className="text-xs mt-2 font-medium" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>{label}</p>}
    </div>
  );
};

// ── Enhanced pillar bar ───────────────────────────────────────────────────────
const PillarBar = ({ pillar, score, isReal, isWeakest, enrichmentDetail }) => {
  const [expanded, setExpanded] = useState(false);
  const color = !isReal || score == null ? 'var(--ink-muted)' : score >= 70 ? 'var(--positive)' : score >= 40 ? 'var(--warning)' : 'var(--danger)';
  const pct = isReal && score != null ? Math.min(score, 100) : 0;
  const Icon = pillar.icon;

  return (
    <div className={`py-3 ${isWeakest ? 'rounded-lg px-2 -mx-2' : ''}`}
      style={{
        borderBottom: '1px solid var(--border)',
        background: isWeakest ? 'var(--danger-wash)' : 'transparent',
      }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ borderRadius: 'var(--r-md, 8px)', background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>{pillar.label}</span>
              {isWeakest && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--danger-wash)', color: 'var(--danger)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', textTransform: 'uppercase' }}>Needs most work</span>}
              <Tooltip text={pillar.desc}>
                <Info className="w-3 h-3 cursor-help" style={{ color: 'var(--ink-muted)' }} />
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              {isReal && score != null
                ? <span className="text-sm font-bold" style={{ color, fontFamily: 'var(--font-mono)' }}>{score}<span className="text-xs" style={{ color: 'var(--ink-muted)' }}>/100</span></span>
                : <span className="text-xs italic" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Insufficient data</span>
              }
              <button onClick={() => setExpanded(e => !e)} className="p-0.5 hover:opacity-70">
                <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--ink-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
            </div>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'var(--surface-2, rgba(140,170,210,0.12))' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ background: color, width: `${pct}%` }} />
          </div>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 ml-11 p-3" style={{ borderRadius: 'var(--r-md, 8px)', background: 'var(--surface-sunken, var(--surface))', border: '1px solid var(--border)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{pillar.desc}</p>
          {isReal && score != null && (
            <div className="flex items-start gap-1.5 mb-2">
              <Zap className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--lava)' }} />
              <p className="text-[11px]" style={{ color: 'var(--lava)', fontFamily: 'var(--font-ui)' }}>{pillar.action}</p>
            </div>
          )}
          {enrichmentDetail && (
            <div className="mt-2 pt-2 space-y-1.5" style={{ borderTop: '1px solid #243140' }}>
              {enrichmentDetail.status && (
                <p className="text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>
                  <span className="text-[#64748B]">Status: </span>
                  <span style={{ color: enrichmentDetail.status === 'strong' ? '#10B981' : '#F59E0B' }}>{enrichmentDetail.status}</span>
                </p>
              )}
              {enrichmentDetail.channels && (
                <p className="text-[10px] text-[#9FB0C3]" style={{ fontFamily: 'var(--font-mono)' }}>Active: {enrichmentDetail.channels.join(', ')}</p>
              )}
              {enrichmentDetail.signals && enrichmentDetail.signals.length > 0 && (
                <p className="text-[10px] text-[#9FB0C3]" style={{ fontFamily: 'var(--font-mono)' }}>Signals: {enrichmentDetail.signals.join(', ')}</p>
              )}
              {enrichmentDetail.strengths?.map((s, i) => (
                <p key={`s${i}`} className="text-[10px] text-[#9FB0C3] flex items-start gap-1"><CheckCircle2 className="w-3 h-3 text-[#10B981] shrink-0 mt-0.5" />{s}</p>
              ))}
              {enrichmentDetail.gaps?.map((g, i) => (
                <p key={`g${i}`} className="text-[10px] text-[#9FB0C3] flex items-start gap-1"><AlertTriangle className="w-3 h-3 text-[#F59E0B] shrink-0 mt-0.5" />{g}</p>
              ))}
              {enrichmentDetail.priority_actions?.map((a, i) => (
                <p key={`a${i}`} className="text-[10px] text-[#9FB0C3] flex items-start gap-1"><Zap className="w-3 h-3 text-[#FF6A00] shrink-0 mt-0.5" />{a}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function CompetitiveBenchmarkPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [hasRealData, setHasRealData] = useState(false);
  const [benchmarkQueued, setBenchmarkQueued] = useState(false);
  const [showProvenance, setShowProvenance] = useState(false);
  const autoBenchmarkTriggeredRef = useRef(false);

  const [enrichmentData, setEnrichmentData] = useState(null);

  // Req 4: Competitor comparison
  const [competitorInputs, setCompetitorInputs] = useState(['']);
  const [competitorResults, setCompetitorResults] = useState([]);
  const [analyzingCompetitor, setAnalyzingCompetitor] = useState(null);
  const [competitorError, setCompetitorError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [snapRes, cogRes, benchRes, profileRes] = await Promise.allSettled([
        apiClient.get('/snapshot/latest'),
        apiClient.get('/cognition/overview'),
        apiClient.get('/marketing/benchmark/latest'),
        apiClient.get('/business-profile'),
      ]);
      const cognitive = snapRes.status === 'fulfilled' ? snapRes.value.data?.cognitive : null;
      const cogData = cogRes.status === 'fulfilled' && cogRes.value.data?.status !== 'MIGRATION_REQUIRED' ? cogRes.value.data : null;
      const benchmark = benchRes.status === 'fulfilled' ? benchRes.value.data : null;
      const profile = profileRes.status === 'fulfilled' ? (profileRes.value?.data || {}) : {};
      const cmoBundle = normalizeCmoBundleScores(parseJsonSafe(profile?.competitor_scan_result));
      const footprint = cognitive?.digital_footprint || {};
      const competitive = cognitive?.competitive_landscape || {};

      // Only use REAL scores — never random fallbacks
      const benchmarkOverall = benchmark?.scores?.overall != null ? Math.round(Number(benchmark.scores.overall) * 100) : null;
      const realScore = footprint.score || benchmarkOverall || cmoBundle?.overall || null;
      const isReal = realScore != null;

      const normalizedBenchmarkPillars = benchmark?.scores ? normalizeBenchmarkScores(benchmark.scores) : {};

      setHasRealData(isReal);
      setData({
        overallScore: realScore,
        pillars: {
          website: footprint.website_score || normalizedBenchmarkPillars.website || cmoBundle?.pillars?.website || null,
          social: footprint.social_score || normalizedBenchmarkPillars.social || cmoBundle?.pillars?.social || null,
          reviews: footprint.review_score || normalizedBenchmarkPillars.reviews || cmoBundle?.pillars?.reviews || null,
          content: footprint.content_score || normalizedBenchmarkPillars.content || cmoBundle?.pillars?.content || null,
          seo: footprint.seo_score || normalizedBenchmarkPillars.seo || cmoBundle?.pillars?.seo || null,
        },
        percentile: footprint.percentile || null,
        industryAvg: footprint.industry_average || null,
        competitors: competitive.competitors || benchmark?.competitors || cmoBundle?.competitors || [],
        trend: footprint.trend || null,
        lastUpdated: footprint.last_scan || benchmark?.updated_at || profile?.updated_at || cogData?.computed_at || null,
        scanSource: footprint.source || benchmark?.status || (cmoBundle ? 'persisted_cmo_bundle' : 'Web scraping'),
        scanDomain: cognitive?.business_profile?.website || null,
      });

      const scanDomain = cognitive?.business_profile?.website || null;
      const knownCompetitors = (competitive?.competitors || [])
        .map((comp) => comp?.domain || comp?.name || comp)
        .filter(Boolean)
        .slice(0, 3);

      if (!benchmark?.scores && !cmoBundle?.overall && scanDomain && !autoBenchmarkTriggeredRef.current) {
        autoBenchmarkTriggeredRef.current = true;
        try {
          const queueRes = await apiClient.post('/marketing/benchmark', { competitors: knownCompetitors }, { timeout: 30000 });
          if (queueRes.data?.status === 'queued' || queueRes.data?.status === 'complete') {
            setBenchmarkQueued(true);
          }
        } catch {
          // non-blocking; the page can still explain the no-data state
        }
      }
    } catch {} finally { setLoading(false); }
    // Fetch enrichment for pillar details
    try {
      const enrRes = await apiClient.get('/enrichment/latest');
      if (enrRes.data?.has_data) setEnrichmentData(enrRes.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    trackEvent('dashboard_view', { page: 'competitive-benchmark' });
  }, [fetchData]);

  useEffect(() => {
    if (!benchmarkQueued || hasRealData) return undefined;
    const timer = setTimeout(() => {
      fetchData();
    }, 12000);
    return () => clearTimeout(timer);
  }, [benchmarkQueued, hasRealData, fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Find weakest pillar
  const weakestPillar = hasRealData && data?.pillars
    ? PILLARS.reduce((min, p) => {
        const v = data.pillars[p.key];
        const minV = data.pillars[min.key];
        return (v != null && (minV == null || v < minV)) ? p : min;
      }, PILLARS[0]).key
    : null;
  const benchmarkProvenance = [
    { label: 'Scan source', value: data?.scanSource || 'Unknown' },
    { label: 'Scan domain', value: data?.scanDomain || 'Not connected' },
    { label: 'Last updated', value: data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString('en-AU') : 'Unknown' },
    { label: 'Evidence confidence', value: hasRealData ? 'Derived from stored benchmark signals' : 'Calibrating (insufficient evidence)' },
  ];

  // Req 4: Analyze a competitor domain
  const analyzeCompetitor = async (domain, idx) => {
    if (!domain?.trim()) return;
    const clean = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    setAnalyzingCompetitor(idx);
    setCompetitorError('');
    try {
      const res = await apiClient.post('/marketing/benchmark', { competitors: [clean] }, { timeout: 30000 });
      if (res.data?.scores) {
        setCompetitorResults(prev => {
          const existing = prev.findIndex(r => r.domain === clean);
          const entry = { domain: clean, scores: normalizeBenchmarkScores(res.data.scores || {}), overallScore: res.data.overall != null ? Math.round(Number(res.data.overall) * 100) : null };
          if (existing >= 0) { const n = [...prev]; n[existing] = entry; return n; }
          return [...prev, entry];
        });
      } else if (res.data?.status === 'queued') {
        setCompetitorError('Benchmark queued. Refresh shortly to compare against the latest stored benchmark.');
      } else {
        setCompetitorError(`Could not fetch data for ${clean}. Try a different domain.`);
      }
    } catch (err) {
      const detail = err?.response?.data?.message || err?.response?.data?.error || err?.message || '';
      console.error(`Benchmark analysis failed for ${clean}:`, err?.response?.data || err);
      setCompetitorError(`Analysis failed for ${clean}${detail ? `: ${detail}` : '. Check the domain and try again.'}`);
    }
    setAnalyzingCompetitor(null);
  };

  const addCompetitorInput = () => {
    if (competitorInputs.length < 5) setCompetitorInputs(prev => [...prev, '']);
  };

  const removeCompetitorInput = (idx) => {
    setCompetitorInputs(prev => prev.filter((_, i) => i !== idx));
    setCompetitorResults(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6" data-testid="competitive-benchmark-page">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)', letterSpacing: 'var(--ls-caps, 0.08em)', fontWeight: 600 }}>
              — Competitive benchmark
            </div>
            <h1 className="font-medium" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: 'var(--ls-display, -0.02em)', lineHeight: 1.05 }}>
              Where you <em style={{ fontStyle: 'italic', color: 'var(--lava)' }}>stand</em>.
            </h1>
            <p className="text-sm mt-2" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
              {hasRealData
                ? `Digital footprint analysis${data?.scanDomain ? ` for ${data.scanDomain}` : ''}. Last scanned: ${data?.lastUpdated ? new Date(data.lastUpdated).toLocaleDateString('en-AU') : 'recently'}.`
                : 'Complete calibration with your business website to generate your Digital Footprint score.'
              }
            </p>
            {enrichmentData?.scanned_at && (
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] text-[#64748B] flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)' }}>
                  Scan: {new Date(enrichmentData.scanned_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {enrichmentData.next_update_available && (
                  <span className="text-[10px] text-[#4A5568] flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)' }}>
                    Next update: {new Date(enrichmentData.next_update_available).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            )}
          </div>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline" className="gap-2"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-1)' }} data-testid="benchmark-provenance-card">
          <CardContent className="p-4">
            <button
              type="button"
              onClick={() => setShowProvenance((prev) => !prev)}
              className="w-full flex items-center justify-between text-left"
              data-testid="benchmark-provenance-toggle"
            >
              <span className="text-xs uppercase" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>Evidence chain</span>
              {showProvenance ? <ChevronDown className="w-4 h-4 rotate-180" style={{ color: 'var(--ink-muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--ink-muted)' }} />}
            </button>
            {showProvenance && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="benchmark-provenance-drawer">
                {benchmarkProvenance.map((item) => (
                  <div key={item.label} className="px-3 py-2" style={{ borderRadius: 'var(--r-md, 8px)', background: 'var(--surface-2, rgba(148,163,184,0.08))', border: '1px solid var(--border)' }}>
                    <p className="text-[10px] uppercase" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>{item.label}</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--ink)', fontFamily: 'var(--font-ui)' }}>{item.value}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Radar / Spider Chart */}
        {!loading && hasRealData && data?.pillars && (() => {
          const labels = ['Website', 'Social', 'Reviews', 'Content', 'SEO'];
          const keys = ['website', 'social', 'reviews', 'content', 'seo'];
          const cx = 200, cy = 200, maxR = 150;
          const angleStep = (2 * Math.PI) / 5;
          const startAngle = -Math.PI / 2;
          const getPoint = (i, r) => ({
            x: cx + r * Math.cos(startAngle + i * angleStep),
            y: cy + r * Math.sin(startAngle + i * angleStep),
          });
          const polygon = (r) => keys.map((_, i) => getPoint(i, r)).map(p => `${p.x},${p.y}`).join(' ');
          const dataPoints = keys.map((k, i) => {
            const score = data.pillars[k] != null ? Math.min(data.pillars[k], 100) : 0;
            return getPoint(i, (score / 100) * maxR);
          });
          const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');
          return (
            <div className="flex justify-center">
              <div style={{ maxWidth: 400, width: '100%' }}>
                <svg viewBox="0 0 400 420" width="100%" style={{ display: 'block' }}>
                  {/* Background pentagons at 20%, 40%, 60%, 80%, 100% */}
                  {[0.2, 0.4, 0.6, 0.8, 1.0].map(pct => (
                    <polygon key={pct} points={polygon(maxR * pct)} fill="none" stroke="var(--border)" strokeWidth="0.5" />
                  ))}
                  {/* Axis lines */}
                  {keys.map((_, i) => {
                    const p = getPoint(i, maxR);
                    return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth="0.5" />;
                  })}
                  {/* Data shape */}
                  <polygon points={dataPolygon} fill="rgba(232,93,0,0.08)" stroke="var(--lava)" strokeWidth="2" />
                  {/* Data points */}
                  {dataPoints.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--lava)" />
                  ))}
                  {/* Labels */}
                  {labels.map((label, i) => {
                    const p = getPoint(i, maxR + 24);
                    return (
                      <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                        style={{ fill: 'var(--ink-muted)', fontSize: '9px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                        {label}
                      </text>
                    );
                  })}
                </svg>
              </div>
            </div>
          );
        })()}

        {loading ? (
          <div className="py-8"><PageLoadingState message="Loading benchmark data..." /></div>
        ) : (
          <>
            {/* Req 3: Score + Percentile (real data only) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-1)' }}>
                <CardContent className="pt-6 flex flex-col items-center">
                  <ScoreGauge score={data?.overallScore} label="Digital Footprint" color="var(--lava)" isReal={hasRealData} />
                  {hasRealData ? (
                    <div className="flex items-center gap-2 mt-4">
                      {data?.trend === 'improving' ? <TrendingUp className="w-4 h-4" style={{ color: 'var(--positive)' }} /> : data?.trend === 'declining' ? <TrendingDown className="w-4 h-4" style={{ color: 'var(--danger)' }} /> : null}
                      <span className="text-xs" style={{ color: data?.trend === 'improving' ? 'var(--positive)' : data?.trend === 'declining' ? 'var(--danger)' : 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                        {data?.trend === 'improving' ? 'Trending up' : data?.trend === 'declining' ? 'Trending down' : 'Stable'}
                      </span>
                    </div>
                  ) : (
                    <div className="text-center mt-4">
                      <p className="text-xs max-w-xs" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>
                        Score is calculated from your public website, social media, Google reviews and content. Complete calibration with your website URL to generate it.
                      </p>
                      {benchmarkQueued && (
                        <p className="text-[11px] mt-3" style={{ color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
                          BIQc has started a benchmark scan for your website. Refresh shortly to see your first score.
                        </p>
                      )}
                      <Link to="/calibration" className="text-xs flex items-center justify-center gap-1 mt-2" style={{ color: 'var(--lava)', fontFamily: 'var(--font-mono)' }}>
                        Start calibration <ArrowRight className="w-3 h-3" />
                      </Link>
                      <p className="text-[11px] mt-3" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
                        Once calibration is complete, BIQc will score your digital footprint and let you compare against competitors across all five pillars.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-1)' }}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Award className="w-5 h-5" style={{ color: 'var(--lava)' }} />
                    <span className="text-xs font-semibold uppercase" style={{ color: 'var(--lava)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>Industry Ranking</span>
                  </div>
                  {hasRealData && data?.percentile != null ? (
                    <>
                      <div className="text-center py-4">
                        <p className="text-5xl font-bold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-mono)' }}>
                          {data.percentile}<span className="text-lg" style={{ color: 'var(--ink-muted)' }}>th</span>
                        </p>
                        <p className="text-sm mt-1" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>percentile in your industry</p>
                      </div>
                      {data.industryAvg != null && (
                        <div className="p-3" style={{ borderRadius: 'var(--r-md, 8px)', background: 'var(--surface-sunken, var(--surface))', border: '1px solid var(--border)' }}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Your score vs industry avg</span>
                            <span className="text-xs" style={{ color: data.overallScore >= data.industryAvg ? 'var(--positive)' : 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
                              {data.overallScore >= data.industryAvg ? `+${data.overallScore - data.industryAvg} above avg` : `${data.overallScore - data.industryAvg} below avg`}
                            </span>
                          </div>
                          <div className="h-2 rounded-full relative" style={{ background: 'var(--surface-2, rgba(140,170,210,0.12))' }}>
                            <div className="absolute h-full rounded-full" style={{ background: 'var(--silver-4, #64748B)', width: `${data.industryAvg}%` }} />
                            <div className="absolute h-full rounded-full" style={{ background: 'var(--lava)', width: `${data.overallScore}%`, opacity: 0.8 }} />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Avg: {data.industryAvg}</span>
                            <span className="text-[10px]" style={{ color: 'var(--lava)', fontFamily: 'var(--font-mono)' }}>You: {data.overallScore}</span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm italic" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Insufficient data</p>
                      <p className="text-xs mt-2" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>Industry ranking will appear once your digital footprint score is generated from calibration and live market inputs.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Req 3: 5-Pillar breakdown with descriptions + tooltips */}
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-1)' }}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" style={{ color: 'var(--lava)' }} />
                    5-Pillar Digital Footprint
                  </div>
                  <Tooltip text="Each pillar measures a different aspect of your digital presence. Click any row to see what it means and how to improve it.">
                    <Info className="w-4 h-4 cursor-help" style={{ color: 'var(--ink-muted)' }} />
                  </Tooltip>
                </CardTitle>
                {weakestPillar && (
                  <p className="text-xs mt-1" style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
                    Focus area: {PILLARS.find(p => p.key === weakestPillar)?.label} — your lowest-scoring pillar
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {PILLARS.map(pillar => {
                  const enr = enrichmentData?.enrichment || {};
                  const detailMap = {
                    website: enr.website_health ? { status: enr.website_health.status, summary: enr.website_health.summary } : null,
                    social: enr.social_media_analysis ? { status: null, channels: enr.social_media_analysis.active_channels, signals: enr.social_media_analysis.content_signals_detected, priority_actions: enr.social_media_analysis.priority_actions } : null,
                    reviews: enr.review_aggregation?.has_data ? { status: null, positive: enr.review_aggregation.positive_count, negative: enr.review_aggregation.negative_count } : null,
                    content: enr.paid_media_analysis ? { status: enr.paid_media_analysis.maturity?.replace(/_/g, ' '), priority_actions: enr.paid_media_analysis.priority_actions } : null,
                    seo: enr.seo_analysis ? { status: enr.seo_analysis.status, strengths: enr.seo_analysis.strengths, gaps: enr.seo_analysis.gaps, priority_actions: enr.seo_analysis.priority_actions } : null,
                  };
                  return (
                    <PillarBar
                      key={pillar.key}
                      pillar={pillar}
                      score={data?.pillars?.[pillar.key]}
                      isReal={hasRealData}
                      isWeakest={pillar.key === weakestPillar}
                      enrichmentDetail={detailMap[pillar.key]}
                    />
                  );
                })}
                {!hasRealData && (
                  <p className="text-xs text-center mt-3 italic" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>
                    Pillar scores will populate once your website has been scanned during calibration.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Req 4: Competitor comparison tool */}
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-1)' }}>
              <CardHeader>
                <div className="text-[10px] uppercase mb-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>— Competitor analysis</div>
                <CardTitle className="flex items-center gap-2" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>
                  <Users className="w-5 h-5" style={{ color: 'var(--lava)' }} />
                  Competitor Benchmarking
                  <Tooltip text="Enter up to 5 competitor domains. BIQc will scan their digital presence and compare them against your 5 pillars.">
                    <Info className="w-4 h-4 cursor-help" style={{ color: 'var(--ink-muted)' }} />
                  </Tooltip>
                </CardTitle>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
                  Enter competitor domains (e.g. competitor.com.au) to see how your digital footprint compares across all 5 pillars.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Input fields */}
                {competitorInputs.map((input, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--ink-muted)' }} />
                      <input
                        value={input}
                        onChange={e => {
                          const updated = [...competitorInputs];
                          updated[idx] = e.target.value;
                          setCompetitorInputs(updated);
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') analyzeCompetitor(input, idx); }}
                        placeholder={`Competitor ${idx + 1} domain (e.g. rivalcompany.com.au)`}
                        className="w-full pl-9 pr-3 py-2 text-sm outline-none"
                        style={{ borderRadius: 'var(--r-md, 8px)', background: 'var(--surface-sunken, var(--surface))', border: '1px solid var(--border)', color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}
                        data-testid={`competitor-input-${idx}`}
                      />
                    </div>
                    <Button onClick={() => analyzeCompetitor(input, idx)} disabled={!input.trim() || analyzingCompetitor === idx}
                      className="gap-1.5 text-xs px-3" style={{ background: 'var(--lava)', color: 'white', border: 'none', borderRadius: 'var(--r-md, 8px)' }}
                      data-testid={`analyze-competitor-${idx}`}>
                      {analyzingCompetitor === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      {analyzingCompetitor === idx ? 'Scanning…' : 'Analyse'}
                    </Button>
                    {competitorInputs.length > 1 && (
                      <button onClick={() => removeCompetitorInput(idx)} className="p-1.5 rounded hover:bg-black/5" style={{ color: 'var(--ink-muted)' }}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {competitorError && (
                  <p className="text-xs" style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>{competitorError}</p>
                )}

                {competitorInputs.length < 5 && (
                  <button onClick={addCompetitorInput} className="flex items-center gap-1.5 text-xs transition-colors"
                    style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                    <Plus className="w-3.5 h-3.5" /> Add another competitor (max 5)
                  </button>
                )}

                {/* Comparison chart */}
                {competitorResults.length > 0 && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold mb-3 uppercase" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>Comparison</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr>
                            <th className="text-left pb-2" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', fontWeight: 500, letterSpacing: 'var(--ls-caps, 0.08em)', textTransform: 'uppercase', fontSize: '10px' }}>Pillar</th>
                            <th className="text-center pb-2" style={{ color: 'var(--lava)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>You</th>
                            {competitorResults.map(r => (
                              <th key={r.domain} className="text-center pb-2 max-w-[80px] truncate" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>
                                {r.domain.replace('www.', '').split('.')[0]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {PILLARS.map(p => (
                            <tr key={p.key} style={{ borderTop: '1px solid var(--border)' }}>
                              <td className="py-2 flex items-center gap-1.5" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>
                                <p.icon className="w-3 h-3" style={{ color: 'var(--ink-muted)' }} />
                                {p.label.split(' ')[0]}
                              </td>
                              <td className="text-center py-2 font-bold" style={{ color: 'var(--lava)', fontFamily: 'var(--font-mono)', background: 'var(--lava-wash)' }}>
                                {hasRealData && data?.pillars?.[p.key] != null ? data.pillars[p.key] : '—'}
                              </td>
                              {competitorResults.map(r => {
                                const cScore = r.scores?.[p.key];
                                const youScore = data?.pillars?.[p.key];
                                const better = cScore != null && youScore != null && youScore > cScore;
                                const worse = cScore != null && youScore != null && youScore < cScore;
                                return (
                                  <td key={r.domain} className="text-center py-2 font-semibold" style={{
                                    color: worse ? 'var(--danger)' : better ? 'var(--positive)' : 'var(--ink-secondary)',
                                    fontFamily: 'var(--font-mono)',
                                  }}>
                                    {cScore ?? '—'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          <tr style={{ borderTop: '2px solid var(--border)' }}>
                            <td className="py-2 font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-mono)' }}>Overall</td>
                            <td className="text-center py-2 font-bold text-base" style={{ color: 'var(--lava)', fontFamily: 'var(--font-mono)', background: 'var(--lava-wash)' }}>
                              {hasRealData && data?.overallScore != null ? data.overallScore : '—'}
                            </td>
                            {competitorResults.map(r => (
                              <td key={r.domain} className="text-center py-2 font-bold text-base" style={{
                                color: r.overallScore != null && data?.overallScore != null && data.overallScore > r.overallScore ? 'var(--positive)' : 'var(--danger)',
                                fontFamily: 'var(--font-mono)',
                              }}>
                                {r.overallScore ?? '—'}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-4 mt-3">
                      <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)' }}><CheckCircle2 className="w-3 h-3" /> You're ahead</span>
                      <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}><AlertTriangle className="w-3 h-3" /> Competitor is ahead</span>
                    </div>
                  </div>
                )}

                {/* Existing competitors from calibration */}
                {data?.competitors?.length > 0 && competitorResults.length === 0 && (
                  <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <p className="text-[10px] uppercase mb-2" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>From your calibration</p>
                    <div className="space-y-1">
                      {data.competitors.slice(0, 5).map((comp, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5">
                          <span className="text-xs" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>{comp.name || comp}</span>
                          <div className="flex items-center gap-2">
                            {comp.threat_level && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{
                                background: comp.threat_level === 'high' ? 'var(--danger-wash)' : 'var(--warning-wash)',
                                color: comp.threat_level === 'high' ? 'var(--danger)' : 'var(--warning)',
                                fontFamily: 'var(--font-mono)',
                                letterSpacing: 'var(--ls-caps, 0.08em)',
                                textTransform: 'uppercase',
                              }}>{comp.threat_level}</span>
                            )}
                            <button onClick={() => {
                              const domain = (comp.domain || comp.name || comp).toLowerCase().replace('https://','').replace('http://','');
                              const emptyIdx = competitorInputs.findIndex(c => !c);
                              if (emptyIdx >= 0) {
                                const updated = [...competitorInputs]; updated[emptyIdx] = domain; setCompetitorInputs(updated);
                              }
                            }} className="text-[9px]" style={{ color: 'var(--lava)', fontFamily: 'var(--font-mono)' }}>
                              Analyse →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
