import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { trackEvent, EVENTS } from '../lib/analytics';
import { PageLoadingState } from '../components/PageStateComponents';
import { fontFamily, colors } from '../design-system/tokens';
import { AlertTriangle, TrendingDown, Clock, CheckCircle2, XCircle, ArrowRight, Loader2, Zap, DollarSign, Users, BarChart3, Calendar, User } from 'lucide-react';
import DecisionPatterns from '../components/intelligence/DecisionPatterns';

const SIGNAL_TO_DECISION = {
  deal_stall: { title: 'Pipeline Stagnation Detected', icon: Clock, domain: 'Revenue', action: 'Kill or reactivate stalled deals', color: colors.warning },
  invoices_overdue_cluster: { title: 'Cash Collection Risk', icon: DollarSign, domain: 'Cash', action: 'Collect overdue invoices or escalate', color: colors.danger },
  cash_burn_acceleration: { title: 'Burn Rate Increasing', icon: TrendingDown, domain: 'Cash', action: 'Review and reduce discretionary spending', color: colors.danger },
  margin_compression: { title: 'Margin Under Pressure', icon: BarChart3, domain: 'Revenue', action: 'Review pricing or reduce cost of delivery', color: colors.warning },
  pipeline_decay: { title: 'Pipeline Value Declining', icon: TrendingDown, domain: 'Revenue', action: 'Accelerate prospecting or re-engage cold leads', color: colors.warning },
  response_delay: { title: 'Client Response Time Slowing', icon: Clock, domain: 'Operations', action: 'Triage response backlog and reassign', color: colors.info },
  meeting_overload: { title: 'Team Meeting Overload', icon: Users, domain: 'People', action: 'Audit meeting necessity, cancel non-essential', color: colors.info },
};

// Derive a display status for a decision prompt
const getPromptStatus = (prompt) => {
  if (prompt.severity === 'critical' || prompt.severity === 'high') return 'urgent';
  return 'pending';
};

// Derive a display status for a history entry
const getHistoryStatus = (entry) => {
  const stmt = (entry.decision_statement || '').toLowerCase();
  if (stmt.includes('defer')) return 'deferred';
  return 'decided';
};

// Status badge colour map matching mockup spec
const STATUS_STYLES = {
  urgent:   { bg: colors.dangerDim,  color: colors.danger  },
  pending:  { bg: colors.warningDim, color: colors.warning },
  decided:  { bg: colors.successDim, color: colors.success },
  deferred: { bg: colors.bgInput,    color: colors.textMuted },
};

export default function DecisionsPage() {
  const [prompts, setPrompts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchDecisionPrompts();
    fetchDecisionHistory();
  }, []);

  const fetchDecisionPrompts = async () => {
    try {
      // Build decision prompts from observation_events
      const res = await apiClient.get('/integrations/merge/connected', { timeout: 8000 });
      const signalCount = res.data?.canonical_truth?.live_signal_count || 0;

      if (signalCount > 0) {
        const snapRes = await apiClient.get('/snapshot/latest', { timeout: 8000 });
        const rq = snapRes.data?.cognitive?.resolution_queue || [];

        const cogRes = await apiClient.get('/cognition/overview', { timeout: 8000 });
        const cogData = cogRes.data || {};

        // Build decision prompts from real signals
        const newPrompts = [];

        // From resolution queue
        rq.forEach(item => {
          if (item.severity === 'high' || item.severity === 'critical') {
            newPrompts.push({
              id: `rq-${item.domain}-${item.title?.substring(0, 20)}`,
              signal: item.title,
              domain: item.domain,
              severity: item.severity,
              recommendation: item.recommendation,
              type: 'resolution_queue',
            });
          }
        });

        // From cognition propagation map
        if (cogData.propagation_map) {
          cogData.propagation_map.forEach(chain => {
            if (chain.probability > 0.7) {
              newPrompts.push({
                id: `prop-${chain.source}-${chain.target}`,
                signal: `${chain.source} instability propagating to ${chain.target}`,
                domain: chain.source,
                severity: 'high',
                recommendation: `Address ${chain.source} issues within ${chain.window} to prevent ${chain.target} impact`,
                type: 'propagation',
                probability: chain.probability,
              });
            }
          });
        }

        setPrompts(newPrompts);
      }
    } catch {} finally { setLoading(false); }
  };

  const fetchDecisionHistory = async () => {
    try {
      const res = await apiClient.get('/cognition/decisions');
      setHistory(res.data?.decisions || []);
    } catch {}
  };

  // Build a unified list of all decisions (active prompts + history) for filtering
  const allDecisions = useMemo(() => {
    const fromPrompts = prompts.map(p => ({ ...p, _source: 'prompt', _status: getPromptStatus(p) }));
    const fromHistory = history.map(h => ({ ...h, _source: 'history', _status: getHistoryStatus(h) }));
    return [...fromPrompts, ...fromHistory];
  }, [prompts, history]);

  // Apply filter
  const filteredPrompts = useMemo(() => {
    if (filter === 'all') return prompts;
    if (filter === 'decided' || filter === 'deferred') return []; // these live in history
    return prompts.filter(p => getPromptStatus(p) === filter);
  }, [prompts, filter]);

  const filteredHistory = useMemo(() => {
    if (filter === 'all') return history;
    if (filter === 'urgent' || filter === 'pending') return []; // these live in prompts
    return history.filter(h => getHistoryStatus(h) === filter);
  }, [history, filter]);

  // Stats computed from unified list
  const stats = useMemo(() => {
    const openCount = prompts.length;
    const decidedCount = history.filter(h => getHistoryStatus(h) === 'decided').length;
    const deferredCount = history.filter(h => getHistoryStatus(h) === 'deferred').length;
    const avgTime = history.length > 0
      ? `${Math.round(history.reduce((s, h) => s + (h.expected_time_horizon || 30), 0) / history.length)}d`
      : '--';
    return [
      { label: 'Open', value: String(openCount) },
      { label: 'Decided', value: String(decidedCount) },
      { label: 'Deferred', value: String(deferredCount) },
      { label: 'Avg time to decide', value: avgTime },
    ];
  }, [prompts, history]);

  const handleRespond = async (prompt, action) => {
    try {
      await apiClient.post('/cognition/decisions', {
        decision_category: prompt.domain || 'operational_change',
        decision_statement: `${action === 'act' ? 'Acting on' : 'Deferring'}: ${prompt.signal}. ${prompt.recommendation || ''}`,
        affected_domains: [prompt.domain?.toLowerCase()].filter(Boolean),
        expected_time_horizon: 30,
      });
      trackEvent(EVENTS.DECISION_RECORDED, { action, domain: prompt.domain, signal: prompt.signal?.substring(0, 50) });
      toast.success(action === 'act' ? 'Decision recorded. Tracking outcome at 30/60/90 days.' : 'Deferred. We\'ll resurface this if it escalates.');
      setPrompts(prev => prev.filter(p => p.id !== prompt.id));
      fetchDecisionHistory();
    } catch {
      toast.error('Failed to record decision.');
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto" data-testid="decisions-page">
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }} data-testid="decisions-title">
              Decisions.
            </h1>
            <p className="text-sm mt-1" style={{ color: '#8FA0B8', fontFamily: fontFamily.body }}>
              Track what you decided, why, and what happened next.
            </p>
          </div>
          <Button
            onClick={() => toast.info('Decision logging coming soon')}
            className="gap-1.5 text-sm font-semibold shrink-0"
            style={{ background: 'linear-gradient(135deg, #E85D00, #FF7A1A)', color: 'white' }}
          >
            <Zap className="w-4 h-4" /> Log decision
          </Button>
        </div>

        {/* Stats strip — mockup dec-stats: 4-col, surface bg, 12px radius, 20px padding */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" data-testid="decisions-stats">
            {stats.map(stat => (
              <div key={stat.label} style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '20px' }}>
                <span className="block" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.textMuted, fontFamily: fontFamily.mono, marginBottom: '8px' }}>{stat.label}</span>
                <span style={{ fontFamily: fontFamily.display, fontSize: '28px', lineHeight: 1, color: colors.text }}>{stat.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filter pills — mockup dec-toolbar: pill buttons with active lava state */}
        {!loading && (
          <div className="flex flex-wrap gap-2 mb-5" data-testid="decisions-filter">
            {['all', 'urgent', 'pending', 'decided', 'deferred'].map(pill => {
              const isActive = filter === pill;
              return (
                <button
                  key={pill}
                  onClick={() => setFilter(pill)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontFamily: fontFamily.mono,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: isActive ? colors.brand : 'transparent',
                    color: isActive ? 'white' : colors.textSecondary,
                    border: isActive ? `1px solid ${colors.brand}` : `1px solid ${colors.border}`,
                  }}
                >
                  {pill}
                </button>
              );
            })}
          </div>
        )}

        {/* Active Decision Prompts — mockup dec-card pattern */}
        {loading ? (
          <PageLoadingState message="Scanning for decision triggers…" />
        ) : filteredPrompts.length > 0 ? (
          <div className="flex flex-col gap-3 mb-8" data-testid="decisions-list">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.brand, fontFamily: fontFamily.mono }}>
              {filteredPrompts.length} Decision{filteredPrompts.length !== 1 ? 's' : ''} Requiring Attention
            </p>
            {filteredPrompts.map(prompt => {
              const config = SIGNAL_TO_DECISION[prompt.type] || { icon: AlertTriangle, color: colors.warning };
              const status = getPromptStatus(prompt);
              const statusStyle = STATUS_STYLES[status];
              return (
                <div
                  key={prompt.id}
                  style={{
                    background: colors.bgCard,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '16px',
                    padding: '24px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                  data-testid={`decision-prompt-${prompt.id}`}
                >
                  {/* Head: title + status badge */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <span style={{ fontFamily: fontFamily.display, fontSize: '22px', lineHeight: 1.2, color: colors.text, letterSpacing: '-0.01em' }}>
                      {prompt.signal}
                    </span>
                    <span style={{
                      padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                      fontFamily: fontFamily.mono, textTransform: 'uppercase', letterSpacing: '0.1em',
                      whiteSpace: 'nowrap', flexShrink: 0,
                      background: statusStyle.bg, color: statusStyle.color,
                    }}>
                      {status}
                    </span>
                  </div>

                  {/* Context paragraph */}
                  {prompt.recommendation && (
                    <p style={{ fontSize: '14px', color: colors.textSecondary, lineHeight: 1.5, marginBottom: '16px', maxWidth: '72ch' }}>
                      {prompt.recommendation}
                    </p>
                  )}

                  {/* Option buttons — mockup dec-option pattern */}
                  <div className="flex gap-2 flex-wrap mb-4">
                    <Button onClick={() => handleRespond(prompt, 'act')} size="sm" className="gap-1.5" style={{
                      padding: '8px 16px', border: `1px solid ${colors.border}`, borderRadius: '8px',
                      fontSize: '14px', color: colors.textSecondary, background: colors.bgInput,
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }} data-testid="decision-act">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Act on this
                    </Button>
                    <Button onClick={() => handleRespond(prompt, 'defer')} size="sm" variant="outline" className="gap-1.5" style={{
                      padding: '8px 16px', border: `1px solid ${colors.border}`, borderRadius: '8px',
                      fontSize: '14px', color: colors.textSecondary, background: colors.bgInput,
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }} data-testid="decision-defer">
                      <Clock className="w-3.5 h-3.5" /> Defer
                    </Button>
                    <a href="/soundboard" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm" style={{ color: colors.brand, fontFamily: fontFamily.mono }}>
                      Ask advisor <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>

                  {/* AI insight note — mockup dec-card__ai-note: gradient lava-wash bg, pulsing dot */}
                  {prompt.recommendation && (
                    <div style={{
                      marginTop: '12px', padding: '12px 16px',
                      background: `linear-gradient(135deg, ${colors.brandDim}, ${colors.bgCard})`,
                      border: `1px solid rgba(232,93,0,0.18)`, borderRadius: '8px',
                      fontSize: '12px', color: colors.textSecondary, lineHeight: 1.5,
                      display: 'flex', alignItems: 'flex-start', gap: '8px',
                    }}>
                      <span style={{
                        width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0, marginTop: '5px',
                        background: colors.brand, boxShadow: `0 0 6px ${colors.brand}`,
                        animation: 'pulse 2s infinite',
                      }} />
                      <span>
                        <strong style={{ color: colors.text }}>BIQc recommendation:</strong>{' '}
                        {prompt.recommendation}
                      </span>
                    </div>
                  )}

                  {/* Meta row — mockup dec-card__meta: date, domain, severity */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                    paddingTop: '12px', marginTop: '12px',
                    borderTop: `1px solid ${colors.border}`,
                    fontSize: '11px', color: colors.textMuted, fontFamily: fontFamily.mono,
                  }}>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {prompt.domain || 'Business'}</span>
                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {prompt.severity}</span>
                    {prompt.probability && (
                      <span>{Math.round(prompt.probability * 100)}% probability</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : filter === 'all' && prompts.length === 0 ? (
          <div className="mb-8" style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '24px' }} data-testid="no-decisions">
            <div className="text-center py-6">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: colors.success }} />
              <p style={{ fontSize: '18px', fontWeight: 600, color: colors.text, fontFamily: fontFamily.display }}>No decisions pending right now</p>
              <p className="mt-1 max-w-sm mx-auto" style={{ fontSize: '14px', color: colors.textMuted, fontFamily: fontFamily.body }}>
                BIQc monitors your connected systems continuously. Decisions surface automatically when deal stalls, cash burn, or operational signals require leadership action.
              </p>
            </div>
          </div>
        ) : null}

        {/* Decision Intelligence Patterns */}
        <div className="mt-8 mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: colors.textMuted, fontFamily: fontFamily.mono }}>
            Decision Intelligence
          </p>
          <DecisionPatterns />
        </div>

        {/* Decision History — mockup dec-card pattern (decided/deferred) */}
        {filteredHistory.length > 0 && (
          <div>
            <p className="mb-4" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.textMuted, fontFamily: fontFamily.mono }}>
              Decision History ({filteredHistory.length})
            </p>
            <div className="flex flex-col gap-3">
              {filteredHistory.map(d => {
                const status = getHistoryStatus(d);
                const statusStyle = STATUS_STYLES[status];
                return (
                  <div key={d.id} style={{
                    background: colors.bgCard, border: `1px solid ${colors.border}`,
                    borderRadius: '16px', padding: '24px',
                    opacity: status === 'deferred' ? 0.7 : 0.85,
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    cursor: 'pointer',
                  }}>
                    {/* Head: title + status badge */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <span style={{ fontFamily: fontFamily.display, fontSize: '22px', lineHeight: 1.2, color: colors.text, letterSpacing: '-0.01em' }}>
                        {d.decision_category || 'Decision'}
                      </span>
                      <span style={{
                        padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                        fontFamily: fontFamily.mono, textTransform: 'uppercase', letterSpacing: '0.1em',
                        whiteSpace: 'nowrap', flexShrink: 0,
                        background: statusStyle.bg, color: statusStyle.color,
                      }}>
                        {status}
                      </span>
                    </div>

                    {/* Context / decision statement */}
                    <p style={{ fontSize: '14px', color: colors.textSecondary, lineHeight: 1.5, marginBottom: '16px', maxWidth: '72ch' }}>
                      {d.decision_statement}
                    </p>

                    {/* Domain badges as chosen options */}
                    {d.affected_domains?.length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-4">
                        {d.affected_domains.map(dom => (
                          <span key={dom} style={{
                            padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                            background: colors.brandDim, border: `1px solid ${colors.brand}`,
                            color: colors.brandDark, display: 'flex', alignItems: 'center', gap: '8px',
                          }}>
                            <span>&#10003;</span> {dom}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Meta row */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                      paddingTop: '12px', borderTop: `1px solid ${colors.border}`,
                      fontSize: '11px', color: colors.textMuted, fontFamily: fontFamily.mono,
                    }}>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {d.created_at ? new Date(d.created_at).toLocaleDateString() : ''}
                      </span>
                      {d.expected_time_horizon && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {d.expected_time_horizon}d horizon
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
