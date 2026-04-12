import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { resolveTier, hasAccess } from '../lib/tierResolver';
import { BarChart3, Target, TrendingUp, Users, Eye, Loader2, RefreshCw, Plug, Clock, Lock, ArrowRight } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

const BENCHMARK_COOLDOWN_KEY = 'biqc_benchmark_last_run';
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days


const PILLAR_LABELS = {
  brand_visibility: { label: 'Brand Visibility', color: '#E85D00', icon: Eye },
  digital_presence: { label: 'Digital Presence', color: '#3B82F6', icon: TrendingUp },
  content_maturity: { label: 'Content Maturity', color: '#10B981', icon: BarChart3 },
  social_engagement: { label: 'Social Engagement', color: '#7C3AED', icon: Users },
  ai_citation_share: { label: 'AI Citation Share', color: '#F59E0B', icon: Target },
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
          fill="none" stroke="rgba(140,170,210,0.15)" strokeWidth="1" />
      ))}
      {data.labels.map((_, i) => { const p = getPoint(1, i); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(140,170,210,0.15)" strokeWidth="0.5" />; })}
      <polygon points={compPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(100,116,139,0.15)" stroke="#64748B" strokeWidth="1.5" strokeDasharray="4" />
      <polygon points={subjectPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(232,93,0,0.15)" stroke="#E85D00" strokeWidth="2" />
      {subjectPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#E85D00" />)}
      {data.labels.map((label, i) => { const p = getPoint(1.2, i); return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fill="#8FA0B8" fontSize="9" fontFamily={MONO}>{label}</text>; })}
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
      <div className="space-y-6 max-w-[1000px]" style={{ fontFamily: fontFamily.body }} data-testid="marketing-intel-page">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>— Marketing</div>
            <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>Marketing <em style={{ fontStyle: 'italic', color: '#E85D00' }}>intelligence</em>.</h1>
            <p className="text-sm mt-1" style={{ color: '#8FA0B8' }}>5-pillar competitive benchmark. Evidence-based scoring.</p>
          </div>
          {benchmark && <button onClick={runBenchmark} disabled={running || !canRun} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:text-[#EDF1F7] disabled:opacity-50" style={{ border: '1px solid var(--biqc-border)', color: canRun ? '#8FA0B8' : '#64748B' }}>
            {!isPaid && !canRun ? (
              <><Clock className="w-3 h-3" /> Next scan in {daysLeft}d</>
            ) : (
              <><RefreshCw className="w-3 h-3" /> Recalibrate</>
            )}
          </button>}
        </div>

        {loading && <div className="text-center py-12"><Loader2 className="w-6 h-6 text-[#E85D00] mx-auto animate-spin" /></div>}

        {!loading && !benchmark && (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <BarChart3 className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-[#EDF1F7] mb-2" style={{ fontFamily: fontFamily.display }}>Run Your First Benchmark</h2>
            <p className="text-sm text-[#64748B] mb-4 max-w-md mx-auto">Compare your marketing presence against up to 5 competitors across Brand Visibility, Digital Presence, Content Maturity, Social Engagement, and AI Citation Share.</p>
            {!isPaid && (
              <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full" style={{ background: '#F59E0B10', border: '1px solid #F59E0B25' }}>
                <Clock className="w-3 h-3" style={{ color: '#F59E0B' }} />
                <span className="text-[11px]" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>Free tier: 1 scan per 30 days</span>
              </div>
            )}
            <input value={competitors} onChange={e => setCompetitors(e.target.value)} placeholder="competitor1.com, competitor2.com, competitor3.com" className="w-full h-11 px-4 rounded-xl text-sm mb-3 outline-none" style={{ background: 'var(--biqc-bg-input)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }} />
            <button onClick={runBenchmark} disabled={running || !canRun} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#E85D00' }}>
              {running ? 'Benchmarking...' : 'Run Benchmark'}
            </button>
          </div>
        )}

        {/* Free tier blocked — 30 day cooldown */}
        {!isPaid && !canRunFree && benchmark && (
          <div className="rounded-2xl p-5" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 shrink-0" style={{ color: '#F59E0B' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>Next free scan available in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#64748B', fontFamily: fontFamily.body }}>Free tier includes 1 benchmark scan per 30 days. Upgrade for unlimited scans.</p>
                </div>
              </div>
              <button onClick={() => window.location.href = '/subscribe?plan=starter&from=/marketing-intelligence'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white shrink-0"
                style={{ background: '#E85D00' }}>
                Upgrade <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {benchmark && (
          <>
            {/* Overall Score */}
            <div className="rounded-2xl p-6 text-center" style={{ background: '#E85D0008', border: '1px solid #E85D0025' }}>
              <span className="text-5xl font-bold" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>{Math.round((benchmark.overall || benchmark.scores?.overall || 0) * 100)}</span>
              <span className="text-lg text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>/100</span>
              <p className="text-sm text-[#8FA0B8] mt-1">Overall Marketing Intelligence Score</p>
            </div>

            {/* Radar + Pillars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
                <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>Competitive Radar</h3>
                <RadarChart data={benchmark.radar || benchmark.radar_data} />
                <div className="flex justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1"><span className="w-3 h-1 rounded" style={{ background: '#E85D00' }} /><span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>You</span></div>
                  <div className="flex items-center gap-1"><span className="w-3 h-1 rounded" style={{ background: '#64748B', borderStyle: 'dashed' }} /><span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Competitors</span></div>
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
                          <span className="text-xs text-[#8FA0B8]">{label}</span>
                          <span className="text-xs font-bold" style={{ fontFamily: fontFamily.mono, color }}>{Math.round(score * 100)}%</span>
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
                <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>Competitors Benchmarked</h3>
                {benchmark.competitors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 py-2" style={{ borderBottom: i < benchmark.competitors.length - 1 ? '1px solid rgba(140,170,210,0.15)' : 'none' }}>
                    <span className="text-xs text-[#EDF1F7]">{c.name || c.domain}</span>
                    <span className="text-[10px] text-[#64748B] ml-auto" style={{ fontFamily: fontFamily.mono }}>{c.domain}</span>
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
