import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { resolveTier, hasAccess } from '../lib/tierResolver';
import { BarChart3, Target, TrendingUp, Users, Eye, Loader2, RefreshCw, Plug, Clock, Lock, ArrowRight } from 'lucide-react';
/* fontFamily import removed — using CSS custom properties */

const BENCHMARK_COOLDOWN_KEY = 'biqc_benchmark_last_run';
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const MONO = 'var(--font-mono)';

const PILLAR_LABELS = {
  brand_visibility: { label: 'Brand Visibility', color: 'var(--lava)', icon: Eye },
  digital_presence: { label: 'Digital Presence', color: 'var(--info)', icon: TrendingUp },
  content_maturity: { label: 'Content Maturity', color: 'var(--positive)', icon: BarChart3 },
  social_engagement: { label: 'Social Engagement', color: 'var(--purple)', icon: Users },
  ai_citation_share: { label: 'AI Citation Share', color: 'var(--warning)', icon: Target },
};

const RadarChart = ({ data }) => {
  if (!data || !data.labels) return null;
  const cx = 150, cy = 150, r = 110;
  const n = data.labels.length;
  const angleStep = (2 * Math.PI) / n;

  const getPoint = (value, i) => {
    const angle = angleStep * i - Math.PI / 2;
    return { x: cx + r * value * Math.cos(angle), y: cy + r * value * Math.sin(angle) };
  };

  const subjectPoints = data.subject.map((v, i) => getPoint(v, i));
  const compPoints = data.competitor_avg.map((v, i) => getPoint(v, i));

  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-[300px] mx-auto">
      {[0.25, 0.5, 0.75, 1.0].map(level => (
        <polygon key={level} points={Array.from({ length: n }, (_, i) => { const p = getPoint(level, i); return `${p.x},${p.y}`; }).join(' ')}
          fill="none" stroke="var(--border)" strokeWidth="1" />
      ))}
      {data.labels.map((_, i) => { const p = getPoint(1, i); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth="0.5" />; })}
      <polygon points={compPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="var(--silver-wash)" stroke="var(--silver-4)" strokeWidth="1.5" strokeDasharray="4" />
      <polygon points={subjectPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="var(--lava-wash)" stroke="var(--lava)" strokeWidth="2" />
      {subjectPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--lava)" />)}
      {data.labels.map((label, i) => { const p = getPoint(1.2, i); return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fill="var(--ink-secondary)" fontSize="9" fontFamily={MONO}>{label}</text>; })}
    </svg>
  );
};

const MarketingIntelPage = () => {
  const { user } = useSupabaseAuth();
  const tier = resolveTier(user);
  const isPaid = hasAccess(tier, 'starter');

  const [benchmark, setBenchmark] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [competitors, setCompetitors] = useState('');

  // 30-day throttle for free tier
  const [lastRunAt, setLastRunAt] = useState(() => {
    try { return parseInt(localStorage.getItem(BENCHMARK_COOLDOWN_KEY) || '0', 10); } catch { return 0; }
  });
  const timeUntilNext = Math.max(0, COOLDOWN_MS - (Date.now() - lastRunAt));
  const daysLeft = Math.ceil(timeUntilNext / (24 * 60 * 60 * 1000));
  const canRunFree = !isPaid && timeUntilNext === 0;
  const canRun = isPaid || canRunFree;

  useEffect(() => {
    apiClient.get('/marketing/benchmark/latest').then(res => {
      if (res.data?.scores) setBenchmark(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const runBenchmark = async () => {
    if (!canRun) return;
    setRunning(true);
    try {
      const compList = competitors.split(',').map(c => c.trim()).filter(Boolean);
      const res = await apiClient.post('/marketing/benchmark', { competitors: compList }, { timeout: 120000 });
      if (res.data?.scores) {
        setBenchmark(res.data);
        // Record run time for free tier throttle
        if (!isPaid) {
          const now = Date.now();
          localStorage.setItem(BENCHMARK_COOLDOWN_KEY, String(now));
          setLastRunAt(now);
        }
      }
    } catch {} finally { setRunning(false); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1000px]" style={{ fontFamily: 'var(--font-ui)' }} data-testid="marketing-intel-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-medium" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: 'var(--ls-display)', lineHeight: 1.05 }}>Marketing Intelligence.</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--ink-secondary)' }}>5-pillar competitive benchmark. Evidence-based scoring.</p>
          </div>
          {benchmark && <button onClick={runBenchmark} disabled={running || !canRun} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:text-[var(--ink-display)] disabled:opacity-50" style={{ border: '1px solid var(--biqc-border)', color: canRun ? 'var(--ink-secondary)' : 'var(--ink-muted)' }}>
            {!isPaid && !canRun ? (
              <><Clock className="w-3 h-3" /> Next scan in {daysLeft}d</>
            ) : (
              <><RefreshCw className="w-3 h-3" /> Recalibrate</>
            )}
          </button>}
        </div>

        {/* KPI Strip — matches mockup mi-kpis */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Campaigns Active', value: '\u2014' },
            { label: 'Total Reach', value: '\u2014' },
            { label: 'Conversion Rate', value: '\u2014' },
            { label: 'Cost per Lead', value: '\u2014' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 20, boxShadow: 'var(--elev-1)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)', color: 'var(--ink-muted)', marginBottom: 12 }}>{kpi.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', lineHeight: 1, color: 'var(--ink-display)', letterSpacing: 'var(--ls-display)' }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* AI Insight -- shows real benchmark insight or empty state */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--lava)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--lava)', animation: 'pulse 2s ease-in-out infinite' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--lava)', letterSpacing: 'var(--ls-caps)' }}>AI Analysis</span>
          </div>
          {benchmark?.insight ? (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>{benchmark.insight}</p>
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>Connect marketing analytics to generate intelligence insights.</p>
          )}
        </div>

        {/* Channel Performance -- empty state until marketing integrations are connected */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Channel Performance</h2>
          <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <Plug className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--ink-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Channel performance data will appear when marketing integrations are connected.</p>
          </div>
        </div>

        {loading && <div className="text-center py-12"><Loader2 className="w-6 h-6 text-[var(--lava)] mx-auto animate-spin" /></div>}

        {!loading && !benchmark && (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <BarChart3 className="w-8 h-8 text-[var(--ink-muted)] mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-[var(--ink-display)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>Run Your First Benchmark</h2>
            <p className="text-sm text-[var(--ink-muted)] mb-4 max-w-md mx-auto">Compare your marketing presence against up to 5 competitors across Brand Visibility, Digital Presence, Content Maturity, Social Engagement, and AI Citation Share.</p>
            {!isPaid && (
              <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full" style={{ background: 'var(--warning-wash)', border: '1px solid var(--warning-ring)' }}>
                <Clock className="w-3 h-3" style={{ color: 'var(--warning)' }} />
                <span className="text-[11px]" style={{ color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>Free tier: 1 scan per 30 days</span>
              </div>
            )}
            <input value={competitors} onChange={e => setCompetitors(e.target.value)} placeholder="competitor1.com, competitor2.com, competitor3.com" className="w-full h-11 px-4 rounded-xl text-sm mb-3 outline-none" style={{ background: 'var(--biqc-bg-input)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }} />
            <button onClick={runBenchmark} disabled={running || !canRun} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--lava)' }}>
              {running ? 'Benchmarking...' : 'Run Benchmark'}
            </button>
          </div>
        )}

        {/* Free tier blocked — 30 day cooldown */}
        {!isPaid && !canRunFree && benchmark && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--warning-wash)', border: '1px solid var(--warning-ring)' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 shrink-0" style={{ color: 'var(--warning)' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--biqc-text)', fontFamily: 'var(--font-display)' }}>Next free scan available in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>Free tier includes 1 benchmark scan per 30 days. Upgrade for unlimited scans.</p>
                </div>
              </div>
              <button onClick={() => window.location.href = '/subscribe?plan=starter&from=/marketing-intelligence'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white shrink-0"
                style={{ background: 'var(--lava)' }}>
                Upgrade <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {benchmark && (
          <>
            {/* Overall Score */}
            <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--lava-wash)', border: '1px solid var(--lava-ring)' }}>
              <span className="text-5xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)' }}>{Math.round((benchmark.overall || benchmark.scores?.overall || 0) * 100)}</span>
              <span className="text-lg text-[var(--ink-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>/100</span>
              <p className="text-sm text-[var(--ink-secondary)] mt-1">Overall Marketing Intelligence Score</p>
            </div>

            {/* Radar + Pillars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
                <h3 className="text-sm font-semibold text-[var(--ink-display)] mb-3" style={{ fontFamily: 'var(--font-display)' }}>Competitive Radar</h3>
                <RadarChart data={benchmark.radar || benchmark.radar_data} />
                <div className="flex justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1"><span className="w-3 h-1 rounded" style={{ background: 'var(--lava)' }} /><span className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>You</span></div>
                  <div className="flex items-center gap-1"><span className="w-3 h-1 rounded" style={{ background: 'var(--silver-4)', borderStyle: 'dashed' }} /><span className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>Competitors</span></div>
                </div>
              </div>

              <div className="space-y-2">
                {Object.entries(PILLAR_LABELS).map(([key, { label, color, icon: Icon }]) => {
                  const score = benchmark.scores?.[key] || 0;
                  return (
                    <div key={key} className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + '15' }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-[var(--ink-secondary)]">{label}</span>
                          <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color }}>{Math.round(score * 100)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: color + '20' }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${score * 100}%`, background: color }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Competitors */}
            {(benchmark.competitors || []).length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
                <h3 className="text-sm font-semibold text-[var(--ink-display)] mb-3" style={{ fontFamily: 'var(--font-display)' }}>Competitors Benchmarked</h3>
                {benchmark.competitors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 py-2" style={{ borderBottom: i < benchmark.competitors.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span className="text-xs text-[var(--ink-display)]">{c.name || c.domain}</span>
                    <span className="text-[10px] text-[var(--ink-muted)] ml-auto" style={{ fontFamily: 'var(--font-mono)' }}>{c.domain}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MarketingIntelPage;
