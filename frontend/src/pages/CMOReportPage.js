/**
 * CMOReportPage — Chief Marketing Officer Intelligence Report (Pro tier).
 *
 * Displays: executive summary, market position score (gauge + bars),
 * competitive landscape table + position matrix, SWOT analysis,
 * review intelligence (rating + sentiment + themes), strategic roadmap
 * (7d / 30d / 90d), and geographic analysis.
 *
 * Data sourced from GET /api/cmo-report or /api/intelligence/cmo-report.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Loader2, TrendingUp, Shield, Globe, Star, MapPin, Target, AlertTriangle, Lightbulb, ChevronRight } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { PageSkeleton } from '../components/ui/skeleton-loader';
import { apiClient } from '../lib/api';

const ProgressBar = ({ label, value, max = 100, gradient }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-baseline">
      <span className="text-sm font-medium" style={{ color: 'var(--ink, #C8D4E4)' }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: 'var(--font-mono)' }}>
        {value}/{max}
      </span>
    </div>
    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-sunken, #060A12)' }}>
      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(value / max) * 100}%`, background: gradient }} />
    </div>
  </div>
);

const ThreatBadge = ({ level }) => {
  const styles = {
    high: { background: 'rgba(220,38,38,0.15)', color: '#F87171' },
    medium: { background: 'rgba(217,119,6,0.15)', color: '#FBBF24' },
    low: { background: 'rgba(22,163,74,0.15)', color: '#4ADE80' },
    you: { background: 'rgba(232,93,0,0.15)', color: 'var(--lava-warm, #FF8A3D)' },
  };
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={styles[level] || styles.low}>
      {level === 'you' ? 'YOU' : level}
    </span>
  );
};

const SwotCard = ({ type, icon, label, items }) => {
  const colors = {
    strength: { border: 'var(--positive, #16A34A)', bg: 'var(--positive-wash, rgba(22,163,74,0.1))', dot: 'var(--positive)' },
    weakness: { border: 'var(--warning, #D97706)', bg: 'var(--warning-wash, rgba(217,119,6,0.1))', dot: 'var(--warning)' },
    opportunity: { border: 'var(--info, #2563EB)', bg: 'var(--info-wash, rgba(37,99,235,0.1))', dot: 'var(--info)' },
    threat: { border: 'var(--danger, #DC2626)', bg: 'var(--danger-wash, rgba(220,38,38,0.1))', dot: 'var(--danger)' },
  };
  const c = colors[type] || colors.strength;
  return (
    <div className="rounded-xl p-5 relative overflow-hidden" style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border, rgba(140,170,210,0.12))' }}>
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: c.border }} />
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: c.bg, color: c.border }}>
          {icon}
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--ink-display, #EDF1F7)' }}>{label}</span>
      </div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="text-sm pl-4 relative" style={{ color: 'var(--ink-secondary, #8FA0B8)', lineHeight: '1.5' }}>
            <span className="absolute left-0 top-2 w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default function CMOReportPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await apiClient.get('/intelligence/cmo-report');
        setReport(res.data);
      } catch {
        // Use fallback empty state
        setReport(null);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  if (loading) {
    return <DashboardLayout><div className="p-8 max-w-6xl mx-auto"><PageSkeleton cards={4} lines={6} /></div></DashboardLayout>;
  }

  // Fallback data when API is unavailable
  const data = report || {};
  const mps = data.market_position || { overall: 0, brand: 0, digital: 0, sentiment: 0, competitive: 0 };
  const competitors = data.competitors || [];
  const swot = data.swot || { strengths: [], weaknesses: [], opportunities: [], threats: [] };
  const reviews = data.reviews || { rating: 0, count: 0, positive_pct: 0, neutral_pct: 0, negative_pct: 0 };
  const roadmap = data.roadmap || { quick_wins: [], priorities: [], strategic: [] };
  const geo = data.geographic || { established: [], growth: [] };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--lava, #E85D00)', fontFamily: 'var(--font-mono)' }}>
              CMO Intelligence Report
            </span>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
            Chief Marketing Summary
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
            {data.company_name || 'Your business'} — {data.report_date || new Date().toLocaleDateString('en-AU')}
          </p>
        </header>

        {/* Executive Summary */}
        {data.executive_summary && (
          <Card>
            <CardHeader><CardTitle className="text-base">Executive Summary</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                {data.executive_summary}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Market Position Score */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5" style={{ color: 'var(--lava, #E85D00)' }} />
              <CardTitle className="text-base">Market Position Score</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-[200px_1fr] gap-6">
              {/* Gauge */}
              <div className="flex flex-col items-center justify-center p-6 rounded-xl" style={{ background: 'var(--surface-sunken, #060A12)' }}>
                <span className="text-5xl font-bold" style={{ color: 'var(--ink-display, #EDF1F7)' }}>{mps.overall || '—'}</span>
                <span className="text-xs mt-1" style={{ color: 'var(--ink-muted, #708499)' }}>out of 100</span>
              </div>
              {/* Bars */}
              <div className="space-y-4 flex flex-col justify-center">
                <ProgressBar label="Brand Strength" value={mps.brand} gradient="linear-gradient(90deg, var(--lava, #E85D00), var(--lava-warm, #FF8A3D))" />
                <ProgressBar label="Digital Presence" value={mps.digital} gradient="linear-gradient(90deg, var(--info, #2563EB), #60A5FA)" />
                <ProgressBar label="Customer Sentiment" value={mps.sentiment} gradient="linear-gradient(90deg, var(--positive, #16A34A), #4ADE80)" />
                <ProgressBar label="Competitive Position" value={mps.competitive} gradient="linear-gradient(90deg, var(--warning, #D97706), #FBBF24)" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Competitive Landscape */}
        {competitors.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" style={{ color: 'var(--info, #2563EB)' }} />
                <CardTitle className="text-base">Competitive Landscape</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface-sunken, #060A12)' }}>
                      {['Company', 'Market Share', 'Key Strengths', 'Digital Visibility', 'Threat'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--ink-muted, #708499)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {competitors.map((c, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]" style={c.is_you ? { background: 'rgba(232,93,0,0.06)' } : {}}>
                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--ink-display)', borderBottom: '1px solid var(--border)' }}>{c.name}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--ink)', borderBottom: '1px solid var(--border)' }}>{c.market_share}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--ink)', borderBottom: '1px solid var(--border)' }}>{c.strengths}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--ink)', borderBottom: '1px solid var(--border)' }}>{c.digital_visibility}</td>
                        <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}><ThreatBadge level={c.threat_level} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SWOT Analysis */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--ink-display, #EDF1F7)' }}>SWOT Analysis</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <SwotCard type="strength" label="Strengths" icon={<Shield className="w-3.5 h-3.5" />} items={swot.strengths.length ? swot.strengths : ['No data available yet']} />
            <SwotCard type="weakness" label="Weaknesses" icon={<AlertTriangle className="w-3.5 h-3.5" />} items={swot.weaknesses.length ? swot.weaknesses : ['No data available yet']} />
            <SwotCard type="opportunity" label="Opportunities" icon={<Lightbulb className="w-3.5 h-3.5" />} items={swot.opportunities.length ? swot.opportunities : ['No data available yet']} />
            <SwotCard type="threat" label="Threats" icon={<AlertTriangle className="w-3.5 h-3.5" />} items={swot.threats.length ? swot.threats : ['No data available yet']} />
          </div>
        </div>

        {/* Review Intelligence */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5" style={{ color: '#FBBF24' }} />
              <CardTitle className="text-base">Review Intelligence</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-[200px_1fr] gap-5">
              {/* Rating */}
              <div className="flex flex-col items-center justify-center p-6 rounded-xl text-center" style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border)' }}>
                <span className="text-5xl font-bold" style={{ color: 'var(--ink-display)' }}>{reviews.rating || '—'}</span>
                <div className="flex gap-0.5 my-1 text-lg text-yellow-400">
                  {[1,2,3,4,5].map(s => <span key={s}>{s <= Math.round(reviews.rating) ? '★' : '☆'}</span>)}
                </div>
                <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{reviews.count} reviews</span>
              </div>
              {/* Sentiment */}
              <div className="flex flex-col justify-center space-y-4 p-6 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {[
                  { label: 'Positive', pct: reviews.positive_pct, color: '#4ADE80' },
                  { label: 'Neutral', pct: reviews.neutral_pct, color: '#94A3B8' },
                  { label: 'Negative', pct: reviews.negative_pct, color: '#F87171' },
                ].map(s => (
                  <div key={s.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span style={{ color: 'var(--ink)' }}>{s.label}</span>
                      <span style={{ color: 'var(--ink-display)' }}>{s.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-sunken)' }}>
                      <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Strategic Roadmap */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Strategic Roadmap</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { title: '7-Day Quick Wins', items: roadmap.quick_wins, color: 'var(--positive, #16A34A)' },
              { title: '30-Day Priorities', items: roadmap.priorities, color: 'var(--warning, #D97706)' },
              { title: '90-Day Strategic', items: roadmap.strategic, color: 'var(--info, #2563EB)' },
            ].map(col => (
              <div key={col.title} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--ink-display)' }}>{col.title}</span>
                </div>
                <ul className="space-y-3">
                  {(col.items.length ? col.items : [{ text: 'No recommendations yet', priority: 'medium' }]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--ink-secondary)' }}>
                      <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: col.color }} />
                      <span>{typeof item === 'string' ? item : item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Geographic Analysis */}
        {(geo.established.length > 0 || geo.growth.length > 0) && (
          <div>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--ink-display, #EDF1F7)' }}>Geographic Analysis</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4" style={{ color: 'var(--positive)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--ink-display)' }}>Established Presence</span>
                </div>
                <div className="space-y-3">
                  {geo.established.map((g, i) => (
                    <ProgressBar key={i} label={g.region} value={g.pct} gradient="linear-gradient(90deg, var(--positive), #4ADE80)" />
                  ))}
                </div>
              </div>
              <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-4 h-4" style={{ color: 'var(--info)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--ink-display)' }}>Growth Opportunities</span>
                </div>
                <div className="space-y-3">
                  {geo.growth.map((g, i) => (
                    <div key={i} className="flex justify-between items-center py-2">
                      <span className="text-sm" style={{ color: 'var(--ink)' }}>{g.region}</span>
                      <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--info-wash, rgba(37,99,235,0.1))', color: 'var(--info)' }}>
                        {g.market_size}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report Footer */}
        <div className="text-center py-4">
          <p className="text-xs" style={{ color: 'var(--ink-muted, #708499)' }}>
            Generated by BIQc Intelligence Engine — Confidence: {data.confidence || '—'}% — {data.report_id || ''}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
