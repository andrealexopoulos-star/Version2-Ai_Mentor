import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { BarChart3, Target, TrendingUp, Users, Eye, Loader2, RefreshCw, Plug } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";

const PILLAR_LABELS = {
  brand_visibility: { label: 'Brand Visibility', color: '#FF6A00', icon: Eye },
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
          fill="none" stroke="#243140" strokeWidth="1" />
      ))}
      {data.labels.map((_, i) => { const p = getPoint(1, i); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#243140" strokeWidth="0.5" />; })}
      <polygon points={compPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(100,116,139,0.15)" stroke="#64748B" strokeWidth="1.5" strokeDasharray="4" />
      <polygon points={subjectPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(255,106,0,0.15)" stroke="#FF6A00" strokeWidth="2" />
      {subjectPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#FF6A00" />)}
      {data.labels.map((label, i) => { const p = getPoint(1.2, i); return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fill="#9FB0C3" fontSize="9" fontFamily={MONO}>{label}</text>; })}
    </svg>
  );
};

const MarketingIntelPage = () => {
  const [benchmark, setBenchmark] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [competitors, setCompetitors] = useState('');

  useEffect(() => {
    apiClient.get('/marketing/benchmark/latest').then(res => {
      if (res.data?.scores) setBenchmark(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const runBenchmark = async () => {
    setRunning(true);
    try {
      const compList = competitors.split(',').map(c => c.trim()).filter(Boolean);
      const res = await apiClient.post('/marketing/benchmark', { competitors: compList }, { timeout: 120000 });
      if (res.data?.scores) setBenchmark(res.data);
    } catch {} finally { setRunning(false); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1000px]" style={{ fontFamily: BODY }} data-testid="marketing-intel-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Marketing Intelligence</h1>
            <p className="text-sm text-[#9FB0C3]">5-pillar competitive benchmark. Evidence-based scoring.</p>
          </div>
          {benchmark && <button onClick={runBenchmark} disabled={running} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#64748B] hover:text-[#F4F7FA]" style={{ border: '1px solid #243140' }}><RefreshCw className="w-3 h-3" /> Recalibrate</button>}
        </div>

        {loading && <div className="text-center py-12"><Loader2 className="w-6 h-6 text-[#FF6A00] mx-auto animate-spin" /></div>}

        {!loading && !benchmark && (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#141C26', border: '1px solid #243140' }}>
            <BarChart3 className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-[#F4F7FA] mb-2" style={{ fontFamily: HEAD }}>Run Your First Benchmark</h2>
            <p className="text-sm text-[#64748B] mb-4 max-w-md mx-auto">Compare your marketing presence against up to 5 competitors across Brand Visibility, Digital Presence, Content Maturity, Social Engagement, and AI Citation Share.</p>
            <input value={competitors} onChange={e => setCompetitors(e.target.value)} placeholder="competitor1.com, competitor2.com, competitor3.com" className="w-full h-11 px-4 rounded-xl text-sm mb-3 outline-none" style={{ background: '#0A1018', border: '1px solid #243140', color: '#F4F7FA' }} />
            <button onClick={runBenchmark} disabled={running} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#FF6A00' }}>
              {running ? 'Benchmarking...' : 'Run Benchmark'}
            </button>
          </div>
        )}

        {benchmark && (
          <>
            {/* Overall Score */}
            <div className="rounded-2xl p-6 text-center" style={{ background: '#FF6A0008', border: '1px solid #FF6A0025' }}>
              <span className="text-5xl font-bold" style={{ fontFamily: MONO, color: '#FF6A00' }}>{Math.round((benchmark.overall || benchmark.scores?.overall || 0) * 100)}</span>
              <span className="text-lg text-[#64748B]" style={{ fontFamily: MONO }}>/100</span>
              <p className="text-sm text-[#9FB0C3] mt-1">Overall Marketing Intelligence Score</p>
            </div>

            {/* Radar + Pillars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl p-5" style={{ background: '#141C26', border: '1px solid #243140' }}>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: HEAD }}>Competitive Radar</h3>
                <RadarChart data={benchmark.radar || benchmark.radar_data} />
                <div className="flex justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1"><span className="w-3 h-1 rounded" style={{ background: '#FF6A00' }} /><span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>You</span></div>
                  <div className="flex items-center gap-1"><span className="w-3 h-1 rounded" style={{ background: '#64748B', borderStyle: 'dashed' }} /><span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>Competitors</span></div>
                </div>
              </div>

              <div className="space-y-2">
                {Object.entries(PILLAR_LABELS).map(([key, { label, color, icon: Icon }]) => {
                  const score = benchmark.scores?.[key] || 0;
                  return (
                    <div key={key} className="rounded-xl p-4 flex items-center gap-3" style={{ background: '#141C26', border: '1px solid #243140' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + '15' }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-[#9FB0C3]">{label}</span>
                          <span className="text-xs font-bold" style={{ fontFamily: MONO, color }}>{Math.round(score * 100)}%</span>
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
              <div className="rounded-2xl p-5" style={{ background: '#141C26', border: '1px solid #243140' }}>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: HEAD }}>Competitors Benchmarked</h3>
                {benchmark.competitors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 py-2" style={{ borderBottom: i < benchmark.competitors.length - 1 ? '1px solid #243140' : 'none' }}>
                    <span className="text-xs text-[#F4F7FA]">{c.name || c.domain}</span>
                    <span className="text-[10px] text-[#64748B] ml-auto" style={{ fontFamily: MONO }}>{c.domain}</span>
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
