/**
 * DecisionPatterns — Shows decision pattern analysis, pending reviews,
 * and consequence tracking from the decision intelligence engine.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/api';
import { fontFamily } from '../../design-system/tokens';
import {
  GitBranch, Clock, CheckCircle2, AlertTriangle,
  TrendingUp, TrendingDown, BarChart3, ChevronDown
} from 'lucide-react';

const DOMAIN_COLORS = {
  finance:    '#22C55E',
  sales:      '#3B82F6',
  operations: '#F59E0B',
  team:       '#EC4899',
  market:     '#8B5CF6',
  regulatory: '#EF4444',
  strategy:   '#E85D00',
};

const DecisionPatterns = () => {
  const [patterns, setPatterns] = useState(null);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState('overview');

  const fetchData = useCallback(async () => {
    try {
      const [patternsRes, reviewsRes] = await Promise.all([
        apiClient.get('/decisions/patterns').catch(() => ({ data: null })),
        apiClient.get('/decisions/pending-reviews').catch(() => ({ data: { reviews: [] } })),
      ]);
      setPatterns(patternsRes.data?.patterns || patternsRes.data || null);
      setPendingReviews(reviewsRes.data?.reviews || []);
    } catch (e) {
      console.error('[DecisionPatterns] fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2].map(i => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
        ))}
      </div>
    );
  }

  const domainBreakdown = patterns?.by_domain || {};
  const totalDecisions = patterns?.total || 0;
  const avgImpact = patterns?.avg_impact || 0;
  const strengths = patterns?.strengths || [];
  const weaknesses = patterns?.weaknesses || [];

  return (
    <div className="space-y-4">
      {/* Pending Reviews Alert */}
      {pendingReviews.length > 0 && (
        <div className="p-4 rounded-xl" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--warning, #D97706)', fontFamily: fontFamily.body }}>
              {pendingReviews.length} decision{pendingReviews.length !== 1 ? 's' : ''} pending review
            </span>
          </div>
          <div className="space-y-1.5">
            {pendingReviews.slice(0, 3).map(review => (
              <div key={review.id} className="flex items-center justify-between text-xs">
                <span className="truncate" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.body, maxWidth: '70%' }}>
                  {review.title}
                </span>
                <span style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>
                  decided {review.decided_at ? new Date(review.decided_at).toLocaleDateString() : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <span className="text-2xl font-semibold block mb-1" style={{ color: '#E85D00', fontFamily: fontFamily.display }}>
            {totalDecisions}
          </span>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>
            Decisions
          </span>
        </div>
        <div className="p-4 rounded-xl text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <span className="text-2xl font-semibold block mb-1" style={{ color: avgImpact > 0.5 ? '#22C55E' : '#F59E0B', fontFamily: fontFamily.display }}>
            {(avgImpact * 100).toFixed(0)}%
          </span>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>
            Avg Impact
          </span>
        </div>
        <div className="p-4 rounded-xl text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <span className="text-2xl font-semibold block mb-1" style={{ color: '#3B82F6', fontFamily: fontFamily.display }}>
            {Object.keys(domainBreakdown).length}
          </span>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>
            Domains
          </span>
        </div>
      </div>

      {/* Domain Breakdown */}
      {Object.keys(domainBreakdown).length > 0 && (
        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4" style={{ color: '#E85D00' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.body }}>
              Decision Domains
            </span>
          </div>
          <div className="space-y-2">
            {Object.entries(domainBreakdown).sort((a, b) => b[1].count - a[1].count).map(([domain, stats]) => {
              const color = DOMAIN_COLORS[domain] || 'var(--ink-muted, #708499)';
              const pct = totalDecisions > 0 ? (stats.count / totalDecisions) * 100 : 0;
              return (
                <div key={domain}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs capitalize" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.body }}>
                      {domain}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>
                      {stats.count}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {strengths.length > 0 && (
            <div className="p-4 rounded-xl" style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4" style={{ color: '#22C55E' }} />
                <span className="text-xs font-medium" style={{ color: '#86EFAC', fontFamily: fontFamily.body }}>Strengths</span>
              </div>
              <ul className="space-y-1">
                {strengths.map((s, i) => (
                  <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>
                    <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: '#22C55E' }} />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {weaknesses.length > 0 && (
            <div className="p-4 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4" style={{ color: '#EF4444' }} />
                <span className="text-xs font-medium" style={{ color: '#FCA5A5', fontFamily: fontFamily.body }}>Areas to Improve</span>
              </div>
              <ul className="space-y-1">
                {weaknesses.map((w, i) => (
                  <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: '#EF4444' }} />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {totalDecisions === 0 && (
        <div className="text-center py-8">
          <GitBranch className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--ink-muted, #708499)' }} />
          <p className="text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>
            No decisions recorded yet. Start logging decisions to build pattern intelligence.
          </p>
        </div>
      )}
    </div>
  );
};

export default DecisionPatterns;
