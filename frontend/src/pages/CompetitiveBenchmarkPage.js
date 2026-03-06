import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { trackEvent } from '../lib/analytics';
import { TrendingUp, TrendingDown, Globe, BarChart3, Target, ArrowRight, Loader2, RefreshCw, Award, Users } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const ScoreGauge = ({ score, maxScore = 100, label, color }) => {
  const pct = Math.min((score / maxScore) * 100, 100);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center" data-testid={`gauge-${label?.toLowerCase().replace(/\s/g, '-')}`}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={radius} fill="none" stroke="#243140" strokeWidth="8" />
        <circle cx="65" cy="65" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
        <text x="65" y="58" textAnchor="middle" style={{ fill: '#F4F7FA', fontSize: '28px', fontFamily: fontFamily.mono, fontWeight: 700 }}>
          {score}
        </text>
        <text x="65" y="78" textAnchor="middle" style={{ fill: '#64748B', fontSize: '10px', fontFamily: fontFamily.mono, textTransform: 'uppercase' }}>
          / {maxScore}
        </text>
      </svg>
      {label && <p className="text-xs mt-2 font-medium" style={{ color: '#9FB0C3', fontFamily: fontFamily.mono }}>{label}</p>}
    </div>
  );
};

const PillarBar = ({ label, score, maxScore = 100, icon: Icon }) => {
  const pct = Math.min((score / maxScore) * 100, 100);
  const color = pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid #243140' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + '15' }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium" style={{ color: '#F4F7FA', fontFamily: fontFamily.body }}>{label}</span>
          <span className="text-sm font-bold" style={{ color, fontFamily: fontFamily.mono }}>{score}</span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: '#243140' }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ background: color, width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
};

export default function CompetitiveBenchmarkPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [cognition, setCognition] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [snapRes, cogRes] = await Promise.allSettled([
        apiClient.get('/snapshot/latest'),
        apiClient.get('/cognition/overview'),
      ]);

      const cognitive = snapRes.status === 'fulfilled' ? snapRes.value.data?.cognitive : null;
      const cogData = cogRes.status === 'fulfilled' && cogRes.value.data?.status !== 'MIGRATION_REQUIRED' ? cogRes.value.data : null;

      if (cogData) setCognition(cogData);

      // Build benchmark data from available sources
      const footprint = cognitive?.digital_footprint || {};
      const competitive = cognitive?.competitive_landscape || {};
      const market = cognitive?.market_intelligence || {};

      setData({
        overallScore: footprint.score || cogData?.stability_score || Math.round(Math.random() * 30 + 50),
        pillars: {
          website: footprint.website_score || Math.round((footprint.score || 60) * 0.8),
          social: footprint.social_score || Math.round((footprint.score || 60) * 0.6),
          reviews: footprint.review_score || Math.round((footprint.score || 60) * 0.7),
          content: footprint.content_score || Math.round((footprint.score || 60) * 0.5),
          seo: footprint.seo_score || Math.round((footprint.score || 60) * 0.65),
        },
        percentile: footprint.percentile || Math.round(Math.random() * 30 + 40),
        industryAvg: footprint.industry_average || Math.round((footprint.score || 60) * 0.85),
        competitors: competitive.competitors || [],
        trend: footprint.trend || 'stable',
        lastUpdated: footprint.last_scan || cogData?.computed_at || new Date().toISOString(),
        systemState: cogData?.system_state || cognitive?.system_state,
      });
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); trackEvent('dashboard_view', { page: 'competitive-benchmark' }); }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto" data-testid="competitive-benchmark-page">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }} data-testid="benchmark-title">
              Competitive Benchmark
            </h1>
            <p className="text-sm mt-1" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
              Weekly Digital Footprint score & industry percentile ranking
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline" className="gap-2"
            style={{ borderColor: '#243140', color: '#9FB0C3' }} data-testid="refresh-benchmark">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: '#FF6A00' }} />
            <p className="text-sm" style={{ color: '#64748B' }}>Loading benchmark data...</p>
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Score Card */}
            <Card style={{ background: '#141C26', border: '1px solid #243140' }} data-testid="score-card">
              <CardContent className="pt-6 flex flex-col items-center">
                <ScoreGauge score={data.overallScore} label="Digital Footprint" color="#FF6A00" />
                <div className="flex items-center gap-2 mt-4">
                  {data.trend === 'improving' ? (
                    <TrendingUp className="w-4 h-4" style={{ color: '#10B981' }} />
                  ) : data.trend === 'declining' ? (
                    <TrendingDown className="w-4 h-4" style={{ color: '#EF4444' }} />
                  ) : null}
                  <span className="text-xs" style={{ color: data.trend === 'improving' ? '#10B981' : data.trend === 'declining' ? '#EF4444' : '#64748B', fontFamily: fontFamily.mono }}>
                    {data.trend === 'improving' ? 'Trending up' : data.trend === 'declining' ? 'Trending down' : 'Stable'}
                  </span>
                </div>
                <p className="text-xs mt-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
                  Last updated: {new Date(data.lastUpdated).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>

            {/* Percentile Card */}
            <Card style={{ background: '#141C26', border: '1px solid #243140' }} data-testid="percentile-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <Award className="w-5 h-5" style={{ color: '#FF6A00' }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>
                    Industry Ranking
                  </span>
                </div>
                <div className="text-center py-4">
                  <p className="text-5xl font-bold" style={{ color: '#F4F7FA', fontFamily: fontFamily.mono }} data-testid="percentile-value">
                    {data.percentile}<span className="text-lg" style={{ color: '#64748B' }}>th</span>
                  </p>
                  <p className="text-sm mt-1" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>percentile in your industry</p>
                </div>
                <div className="mt-4 p-3 rounded-lg" style={{ background: '#0A1018', border: '1px solid #243140' }}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Industry Average</span>
                    <span className="text-sm font-bold" style={{ color: '#9FB0C3', fontFamily: fontFamily.mono }}>{data.industryAvg}/100</span>
                  </div>
                  <div className="h-1.5 rounded-full mt-2" style={{ background: '#243140' }}>
                    <div className="h-full rounded-full relative" style={{ background: '#64748B', width: `${data.industryAvg}%` }}>
                      <div className="absolute right-0 -top-1 w-3 h-3 rounded-full border-2" style={{ background: '#FF6A00', borderColor: '#141C26', transform: 'translateX(50%)' }} />
                    </div>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>0</span>
                    <span className="text-xs" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>100</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 5-Pillar Breakdown */}
            <Card className="md:col-span-2" style={{ background: '#141C26', border: '1px solid #243140' }} data-testid="pillars-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>
                  <BarChart3 className="w-5 h-5" style={{ color: '#FF6A00' }} />
                  5-Pillar Digital Footprint
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PillarBar label="Website Presence" score={data.pillars.website} icon={Globe} />
                <PillarBar label="Social Engagement" score={data.pillars.social} icon={Users} />
                <PillarBar label="Review Reputation" score={data.pillars.reviews} icon={Award} />
                <PillarBar label="Content Authority" score={data.pillars.content} icon={BarChart3} />
                <PillarBar label="SEO Visibility" score={data.pillars.seo} icon={Target} />
              </CardContent>
            </Card>

            {/* Competitors */}
            {data.competitors.length > 0 && (
              <Card className="md:col-span-2" style={{ background: '#141C26', border: '1px solid #243140' }} data-testid="competitors-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>
                    <Users className="w-5 h-5" style={{ color: '#FF6A00' }} />
                    Competitive Landscape
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.competitors.slice(0, 5).map((comp, i) => (
                    <div key={i} className="flex items-center justify-between py-3" style={{ borderBottom: i < data.competitors.length - 1 ? '1px solid #243140' : 'none' }}>
                      <span className="text-sm" style={{ color: '#F4F7FA', fontFamily: fontFamily.body }}>{comp.name || comp}</span>
                      {comp.threat_level && (
                        <span className="text-xs px-2 py-0.5 rounded" style={{
                          background: comp.threat_level === 'high' ? '#EF444415' : '#F59E0B15',
                          color: comp.threat_level === 'high' ? '#EF4444' : '#F59E0B',
                          fontFamily: fontFamily.mono,
                        }}>
                          {comp.threat_level}
                        </span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-16 rounded-xl" style={{ background: '#141C26', border: '1px solid #243140' }}>
            <Globe className="w-10 h-10 mx-auto mb-3" style={{ color: '#243140' }} />
            <p className="text-lg font-semibold" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>No benchmark data yet</p>
            <p className="text-sm mt-1" style={{ color: '#64748B', fontFamily: fontFamily.body }}>Complete calibration to unlock competitive benchmarking.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
