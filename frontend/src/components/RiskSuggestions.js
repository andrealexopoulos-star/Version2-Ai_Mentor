import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { fontFamily, colors } from '../design-system/tokens';
import { trackEvent, EVENTS } from '../lib/analytics';
import { toast } from 'sonner';
import { AlertTriangle, TrendingDown, Clock, DollarSign, Users, CheckCircle2, X, ArrowRight, BarChart3, Zap } from 'lucide-react';

const SIGNAL_CONFIG = {
  deal_stall: { title: 'Stalled Pipeline', icon: Clock, color: colors.warning, domain: 'Revenue',
    action: 'Review and reactivate or close stalled deals' },
  invoices_overdue_cluster: { title: 'Overdue Invoices', icon: DollarSign, color: colors.danger, domain: 'Cash',
    action: 'Contact clients with overdue invoices this week' },
  cash_burn_acceleration: { title: 'Burn Rate Rising', icon: TrendingDown, color: colors.danger, domain: 'Cash',
    action: 'Review discretionary spend and defer non-essential costs' },
  margin_compression: { title: 'Margin Pressure', icon: BarChart3, color: colors.warning, domain: 'Revenue',
    action: 'Review pricing and cost of delivery' },
  pipeline_decay: { title: 'Pipeline Shrinking', icon: TrendingDown, color: colors.warning, domain: 'Revenue',
    action: 'Accelerate prospecting and re-engage cold leads' },
  response_delay: { title: 'Response Times Slowing', icon: Clock, color: colors.info, domain: 'Operations',
    action: 'Triage and reassign response backlog' },
  meeting_overload: { title: 'Meeting Overload', icon: Users, color: colors.info, domain: 'People',
    action: 'Cancel non-essential meetings this week' },
};

export const RiskSuggestions = () => {
  const [risks, setRisks] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('biqc_dismissed_risks') || '[]'); } catch { return []; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRisks();
  }, []);

  const fetchRisks = async () => {
    try {
      // Get canonical truth for signal count
      const truthRes = await apiClient.get('/integrations/merge/connected');
      const truth = truthRes.data?.canonical_truth;

      if (!truth || truth.live_signal_count === 0) { setLoading(false); return; }

      // Get cognition overview for propagation chains
      const cogRes = await apiClient.get('/cognition/overview');
      const cogData = cogRes.data;

      // Get snapshot for resolution queue
      const snapRes = await apiClient.get('/snapshot/latest');
      const rq = snapRes.data?.cognitive?.resolution_queue || [];

      const detected = [];

      // From propagation map — high probability chains
      if (cogData?.propagation_map) {
        cogData.propagation_map.forEach((chain, i) => {
          if (chain.probability > 0.65) {
            detected.push({
              id: `prop-${chain.source}-${chain.target}`,
              type: 'propagation',
              severity: chain.probability > 0.85 ? 'critical' : 'high',
              title: `${chain.source} instability spreading to ${chain.target}`,
              detail: `${Math.round(chain.probability * 100)}% probability within ${chain.window}. If ${chain.source} issues aren't addressed, ${chain.target} will be impacted.`,
              domain: chain.source,
              action: `Stabilise ${chain.source} this week to prevent ${chain.target} cascade`,
              probability: chain.probability,
            });
          }
        });
      }

      // From resolution queue — high severity items
      rq.forEach(item => {
        if (item.severity === 'high' || item.severity === 'critical') {
          detected.push({
            id: `rq-${item.domain}-${(item.title || '').substring(0, 20)}`,
            type: item.signal_name || 'resolution',
            severity: item.severity,
            title: item.title || item.signal,
            detail: item.recommendation || '',
            domain: item.domain,
            action: item.recommendation || 'Review and take action',
          });
        }
      });

      // Deduplicate by id
      const seen = new Set();
      const unique = detected.filter(r => {
        if (seen.has(r.id) || dismissed.includes(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      setRisks(unique.slice(0, 5));
    } catch {} finally { setLoading(false); }
  };

  const handleAct = async (risk) => {
    try {
      await apiClient.post('/cognition/decisions', {
        decision_category: risk.domain?.toLowerCase() || 'operational_change',
        decision_statement: `Acting on: ${risk.title}. ${risk.action}`,
        affected_domains: [risk.domain?.toLowerCase()].filter(Boolean),
        expected_time_horizon: 30,
      });
      trackEvent(EVENTS.DECISION_RECORDED, { action: 'act_on_risk', domain: risk.domain });
      toast.success('Decision recorded. Tracking outcome at 30/60/90 days.');
    } catch {}
    setRisks(prev => prev.filter(r => r.id !== risk.id));
  };

  const handleDismiss = (risk) => {
    const updated = [...dismissed, risk.id];
    setDismissed(updated);
    sessionStorage.setItem('biqc_dismissed_risks', JSON.stringify(updated));
    setRisks(prev => prev.filter(r => r.id !== risk.id));
  };

  if (loading || risks.length === 0) return null;

  return (
    <div className="mb-6" data-testid="risk-suggestions">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4" style={{ color: colors.warning }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.warning, fontFamily: fontFamily.mono }}>
          {risks.length} Risk{risks.length !== 1 ? 's' : ''} Requiring Attention
        </span>
      </div>

      <div className="space-y-3">
        {risks.map(risk => {
          const config = SIGNAL_CONFIG[risk.type] || {};
          const Icon = config.icon || AlertTriangle;
          const color = config.color || colors.warning;

          return (
            <div key={risk.id} className="rounded-xl p-4 relative" style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderLeftWidth: 3, borderLeftColor: color }}
              data-testid={`risk-${risk.id}`}>

              <button onClick={() => handleDismiss(risk)} className="absolute top-3 right-3 p-1 rounded hover:bg-white/5" style={{ color: colors.textMuted }}>
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + '15' }}>
                  <Icon className="w-4.5 h-4.5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold uppercase" style={{ color, fontFamily: fontFamily.mono }}>{risk.domain}</span>
                    {risk.probability && (
                      <span className="text-xs" style={{ color: colors.textMuted, fontFamily: fontFamily.mono }}>{Math.round(risk.probability * 100)}%</span>
                    )}
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: colors.text, fontFamily: fontFamily.body }}>{risk.title}</p>
                  {risk.detail && <p className="text-xs mb-3" style={{ color: colors.textSecondary }}>{risk.detail}</p>}

                  <div className="flex items-center gap-2">
                    <button onClick={() => handleAct(risk)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110"
                      style={{ background: colors.success, color: 'white', fontFamily: fontFamily.mono }} data-testid="risk-act">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Acting on this
                    </button>
                    <button onClick={() => handleDismiss(risk)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: colors.bgInput, color: colors.textMuted, border: `1px solid ${colors.border}`, fontFamily: fontFamily.mono }} data-testid="risk-dismiss">
                      Acknowledged
                    </button>
                    <a href="/soundboard" className="flex items-center gap-1 text-xs ml-auto" style={{ color: colors.brand, fontFamily: fontFamily.mono }}>
                      Ask advisor <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RiskSuggestions;
