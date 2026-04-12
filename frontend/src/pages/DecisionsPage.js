import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { trackEvent, EVENTS } from '../lib/analytics';
import { PageLoadingState } from '../components/PageStateComponents';
import { fontFamily, colors } from '../design-system/tokens';
import { AlertTriangle, TrendingDown, Clock, CheckCircle2, XCircle, ArrowRight, Loader2, Zap, DollarSign, Users, BarChart3 } from 'lucide-react';
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

export default function DecisionsPage() {
  const [prompts, setPrompts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>— Governance</div>
          <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }} data-testid="decisions-title">
            Decisions <em style={{ fontStyle: 'italic', color: '#E85D00' }}>log</em>.
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8FA0B8', fontFamily: fontFamily.body }}>
            BIQc detects when your business signals require a leadership decision. Respond here. Outcomes tracked at 30, 60, and 90 days.
          </p>
        </div>

        {/* Stats strip — mirrors mockup (Open / Decided / Deferred / Avg time) */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8" data-testid="decisions-stats">
            {[
              { label: 'Open', value: String(prompts.length) },
              { label: 'Decided', value: String(history.length) },
              { label: 'Deferred', value: String(history.filter(h => (h.decision_statement || '').toLowerCase().includes('defer')).length) },
              { label: 'Avg time to decide', value: history.length > 0 ? `${Math.round(history.reduce((s, h) => s + (h.expected_time_horizon || 30), 0) / history.length)}d` : '--' },
            ].map(stat => (
              <div key={stat.label} className="rounded-lg p-4" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: colors.textMuted, fontFamily: fontFamily.mono }}>{stat.label}</span>
                <span className="text-2xl font-bold" style={{ color: colors.text, fontFamily: fontFamily.display }}>{stat.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Active Decision Prompts — from signals */}
        {loading ? (
          <PageLoadingState message="Scanning for decision triggers…" />
        ) : prompts.length > 0 ? (
          <div className="space-y-4 mb-8">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.brand, fontFamily: fontFamily.mono }}>
              {prompts.length} Decision{prompts.length !== 1 ? 's' : ''} Requiring Attention
            </p>
            {prompts.map(prompt => {
              const config = SIGNAL_TO_DECISION[prompt.type] || { icon: AlertTriangle, color: colors.warning };
              const Icon = config.icon || AlertTriangle;
              return (
                <Card key={prompt.id} style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderLeftWidth: 3, borderLeftColor: config.color || colors.warning }} data-testid={`decision-prompt-${prompt.id}`}>
                  <CardContent className="py-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: (config.color || colors.warning) + '15' }}>
                        <Icon className="w-5 h-5" style={{ color: config.color || colors.warning }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: config.color || colors.warning, fontFamily: fontFamily.mono }}>
                            {prompt.domain || 'Business'}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: colors.bgInput, color: colors.textMuted, fontFamily: fontFamily.mono }}>
                            {prompt.severity}
                          </span>
                          {prompt.probability && (
                            <span className="text-xs" style={{ color: colors.textMuted, fontFamily: fontFamily.mono }}>
                              {Math.round(prompt.probability * 100)}% probability
                            </span>
                          )}
                        </div>
                        <p className="text-sm leading-relaxed mb-2" style={{ color: colors.text, fontFamily: fontFamily.body }}>
                          {prompt.signal}
                        </p>
                        {prompt.recommendation && (
                          <p className="text-xs mb-3" style={{ color: colors.textSecondary, fontFamily: fontFamily.body }}>
                            Suggested: {prompt.recommendation}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button onClick={() => handleRespond(prompt, 'act')} size="sm" className="gap-1.5 text-xs" style={{ background: colors.success, color: 'white' }} data-testid="decision-act">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Acting on this
                          </Button>
                          <Button onClick={() => handleRespond(prompt, 'defer')} size="sm" variant="outline" className="gap-1.5 text-xs" style={{ borderColor: colors.border, color: colors.textSecondary }} data-testid="decision-defer">
                            <Clock className="w-3.5 h-3.5" /> Defer
                          </Button>
                          <a href="/soundboard" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs" style={{ color: colors.brand, fontFamily: fontFamily.mono }}>
                            Ask advisor <ArrowRight className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="mb-8" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }} data-testid="no-decisions">
            <CardContent className="text-center py-10">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: colors.success }} />
              <p className="text-lg font-semibold" style={{ color: colors.text, fontFamily: fontFamily.display }}>No decisions pending right now</p>
              <p className="text-sm mt-1 max-w-sm mx-auto" style={{ color: colors.textMuted, fontFamily: fontFamily.body }}>
                BIQc monitors your connected systems continuously. Decisions surface automatically when deal stalls, cash burn, or operational signals require leadership action.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Decision Intelligence Patterns */}
        <div className="mt-8 mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: colors.textMuted, fontFamily: fontFamily.mono }}>
            Decision Intelligence
          </p>
          <DecisionPatterns />
        </div>

        {/* Decision History */}
        {history.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: colors.textMuted, fontFamily: fontFamily.mono }}>
              Decision History ({history.length})
            </p>
            <div className="space-y-3">
              {history.map(d => (
                <div key={d.id} className="rounded-lg p-4" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold uppercase" style={{ color: colors.brand, fontFamily: fontFamily.mono }}>{d.decision_category}</span>
                    <span className="text-xs" style={{ color: colors.textMuted, fontFamily: fontFamily.mono }}>{d.created_at ? new Date(d.created_at).toLocaleDateString() : ''}</span>
                  </div>
                  <p className="text-sm" style={{ color: colors.text }}>{d.decision_statement}</p>
                  {d.affected_domains?.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {d.affected_domains.map(dom => (
                        <span key={dom} className="text-xs px-2 py-0.5 rounded" style={{ background: colors.brandDim, color: colors.brand, fontFamily: fontFamily.mono }}>{dom}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
