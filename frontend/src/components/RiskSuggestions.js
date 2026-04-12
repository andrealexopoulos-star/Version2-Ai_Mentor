/**
 * RiskSuggestions — Contextual risk alerts using full snapshot data
 *
 * Shows specific, actionable risks using:
 * - propagation_map (statistical risk chains)
 * - founder_vitals (Outlook calendar, capacity)
 * - capital (runway, margin, scenario projections)
 * - revenue (pipeline, deals from HubSpot if connected)
 * - priority (AI-ranked action items)
 * - resolution_queue (specific compliance/integration items)
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { fontFamily, colors } from '../design-system/tokens';
import { trackEvent, EVENTS } from '../lib/analytics';
import { toast } from 'sonner';
import { AlertTriangle, TrendingDown, Clock, DollarSign, Users, CheckCircle2, X, ArrowRight, BarChart3, Zap, Calendar, Target } from 'lucide-react';

// ── Domain → icon map ─────────────────────────────────────────────────────────
const DOMAIN_CFG = {
  revenue:    { icon: TrendingDown, color: '#E85D00' },
  finance:    { icon: DollarSign,   color: '#F59E0B' },
  people:     { icon: Users,        color: '#3B82F6' },
  operations: { icon: BarChart3,    color: '#8B5CF6' },
  market:     { icon: Target,       color: '#10B981' },
  calendar:   { icon: Calendar,     color: '#06B6D4' },
  default:    { icon: AlertTriangle, color: '#EF4444' },
};

function domainCfg(domain = '') {
  return DOMAIN_CFG[(domain || '').toLowerCase()] || DOMAIN_CFG.default;
}

// ── Enrich a propagation chain with specific context ─────────────────────────
function enrichPropagation(chain, cognitive) {
  const src = (chain.source || '').toLowerCase();
  const tgt = (chain.target || '').toLowerCase();
  const pct = Math.round((chain.probability || 0) * 100);
  const window = chain.window || '7 days';

  // Pull specific data from cognitive snapshot
  const capital  = cognitive?.capital  || {};
  const revenue  = cognitive?.revenue  || {};
  const vitals   = cognitive?.founder_vitals || {};
  const priority = cognitive?.priority || {};
  const memo     = cognitive?.memo || '';

  let detail = '';
  let specific_action = '';
  let evidence = '';

  if (src === 'revenue') {
    const deals = revenue.deals?.length > 0 ? `${revenue.deals.length} active deal${revenue.deals.length > 1 ? 's' : ''}` : 'pipeline';
    const entropy = revenue.entropy || 'uncertainty in pipeline';
    detail = `Your ${deals} show ${entropy}. A ${pct}% cascade risk to cash flow is projected within ${window}.`;
    evidence = capital.base ? `Base case: ${capital.base}. Best case if addressed: ${capital.best}.` : '';
    specific_action = priority.primary || 'Review and close at-risk deals. Follow up on outstanding proposals this week.';
  } else if (src === 'finance') {
    const runway = capital.runway ? `${capital.runway} months cash runway` : 'cash position';
    const margin = capital.margin ? `margins are ${capital.margin}` : 'margin under pressure';
    detail = `Your ${runway} shows strain — ${margin}. Without intervention, ${tgt} resourcing is at ${pct}% risk within ${window}.`;
    evidence = capital.worst ? `Worst case if unaddressed: ${capital.worst}.` : '';
    specific_action = `Review cost structure and defer non-essential spend. Connect Xero to get exact cash flow figures.`;
  } else if (src === 'people') {
    const calendar = vitals.calendar || 'calendar data available via Outlook';
    const fatigue = vitals.fatigue || 'normal';
    detail = `Capacity signals from Outlook show ${calendar}. Fatigue level is ${fatigue}. At ${pct}% probability, people pressure will impact ${tgt} within ${window}.`;
    evidence = vitals.recommendation || '';
    specific_action = `Delegate or defer lower-priority tasks. Protect focus time for strategic ${tgt} activities.`;
  } else {
    detail = `${src} instability is propagating to ${tgt} with ${pct}% probability within ${window}. Available data points to systemic risk.`;
    specific_action = priority.primary || `Address ${src} root cause before it cascades to ${tgt}.`;
  }

  return { detail, evidence, specific_action };
}

export const RiskSuggestions = () => {
  const [risks, setRisks] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('biqc_dismissed_risks') || '[]'); } catch { return []; }
  });
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  useEffect(() => { fetchRisks(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRisks = async () => {
    try {
      // Primary: get full snapshot with all cognitive fields
      const snapRes = await apiClient.get('/snapshot/latest');
      const cognitive = snapRes.data?.cognitive || {};

      const detected = [];

      // 1. Propagation chains — enriched with specific context
      const propMap = cognitive.propagation_map || [];
      propMap.forEach((chain, i) => {
        if ((chain.probability || 0) > 0.60) {
          const { detail, evidence, specific_action } = enrichPropagation(chain, cognitive);
          detected.push({
            id: `prop-${chain.source}-${chain.target}-${i}`,
            type: 'propagation',
            severity: chain.probability > 0.85 ? 'critical' : 'high',
            title: `${(chain.source || '').charAt(0).toUpperCase() + (chain.source || '').slice(1)} risk spreading to ${chain.target}`,
            detail,
            evidence,
            domain: chain.source || 'operations',
            action: specific_action,
            probability: Math.round((chain.probability || 0) * 100),
            window: chain.window,
            data_source: chain.mechanism || 'Cross-domain analysis',
          });
        }
      });

      // 2. Resolution queue items — high severity
      const rq = cognitive.resolution_queue || [];
      rq.forEach(item => {
        if ((item.severity === 'high' || item.severity === 'critical') && item.title) {
          // Skip "Email Integration Required" if Outlook is connected
          const title = (item.title || '').toLowerCase();
          if (title.includes('email integration') || title.includes('email not connected')) return;

          detected.push({
            id: `rq-${item.domain}-${(item.title || '').substring(0, 20)}`,
            type: item.signal_name || 'resolution',
            severity: item.severity,
            title: item.title,
            detail: item.detail || item.recommendation || '',
            evidence: '',
            domain: item.domain,
            action: item.recommendation || 'Review and take action',
            data_source: 'Compliance & Governance',
          });
        }
      });

      // 3. Calendar signal from founder_vitals (Outlook data)
      const vitals = cognitive?.founder_vitals || {};
      if (vitals.calendar && vitals.calendar.includes('week')) {
        const calInfo = vitals.calendar;
        const fatigue = vitals.fatigue || 'normal';
        if (fatigue === 'high' || calInfo.includes('0 meetings') || calInfo.includes('above average')) {
          detected.push({
            id: 'calendar-capacity',
            type: 'calendar',
            severity: 'medium',
            title: 'Calendar Capacity Signal',
            detail: `Outlook shows: ${calInfo} Founder fatigue: ${fatigue}.`,
            evidence: vitals.recommendation || '',
            domain: 'people',
            action: 'Review this week\'s calendar. Protect strategic focus time.',
            data_source: 'Outlook Calendar',
          });
        }
      }

      // 4. Priority item from AI analysis
      const priority = cognitive?.priority || {};
      if (priority.primary && detected.length < 3) {
        detected.push({
          id: 'ai-priority-primary',
          type: 'priority',
          severity: 'medium',
          title: 'AI-Ranked Priority Action',
          detail: `BIQc recommends focusing on: ${priority.primary}`,
          evidence: priority.secondary ? `Secondary: ${priority.secondary}` : '',
          domain: 'operations',
          action: `${priority.primary} (~${priority.primary_hrs || 'a few hours'} estimated)`,
          data_source: 'AI Analysis',
        });
      }

      // Deduplicate + filter dismissed
      const seen = new Set();
      const unique = detected.filter(r => {
        if (seen.has(r.id) || dismissed.includes(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      setRisks(unique.slice(0, 5));
    } catch (e) {
      console.error('RiskSuggestions fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAct = async (risk) => {
    setActing(risk.id);
    try {
      await apiClient.post('/cognition/decisions', {
        decision_category: risk.domain?.toLowerCase() || 'operational_change',
        decision_statement: `Acting on: ${risk.title}. ${risk.action}`,
        affected_domains: [risk.domain?.toLowerCase()].filter(Boolean),
        expected_time_horizon: 30,
      });
      trackEvent(EVENTS.DECISION_RECORDED, { action: 'act_on_risk', domain: risk.domain });
      toast.success('Decision recorded. BIQc will track outcome at 30/60/90 days.');
    } catch {}
    setRisks(prev => prev.filter(r => r.id !== risk.id));
    setActing(null);
  };

  const handleDismiss = (riskId) => {
    const updated = [...dismissed, riskId];
    setDismissed(updated);
    sessionStorage.setItem('biqc_dismissed_risks', JSON.stringify(updated));
    setRisks(prev => prev.filter(r => r.id !== riskId));
  };

  if (loading || risks.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="risk-suggestions">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-4 h-4" style={{ color: '#F59E0B' }} />
        <h3 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>
          {risks.length} Risk{risks.length !== 1 ? 's' : ''} Requiring Attention
        </h3>
      </div>

      {risks.map(risk => {
        const cfg = domainCfg(risk.domain);
        const Icon = cfg.icon;
        const sevColor = risk.severity === 'critical' ? '#EF4444' : risk.severity === 'high' ? '#F59E0B' : '#3B82F6';

        return (
          <div key={risk.id}
            className="rounded-xl p-4 relative"
            style={{ background: '#0F1720', border: `1px solid ${sevColor}30` }}
            data-testid={`risk-card-${risk.id}`}>

            {/* Dismiss */}
            <button onClick={() => handleDismiss(risk.id)}
              className="absolute top-3 right-3 p-1 rounded hover:bg-white/5 transition-colors"
              style={{ color: '#4A5568' }}>
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-3 mb-2 pr-6">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${cfg.color}15` }}>
                <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: sevColor, fontFamily: fontFamily.mono }}>
                    {(risk.domain || '').toUpperCase()}
                  </span>
                  {risk.probability !== undefined && (
                    <span className="text-[10px] font-semibold" style={{ color: sevColor, fontFamily: fontFamily.mono }}>
                      {risk.probability}%
                    </span>
                  )}
                  {risk.data_source && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${cfg.color}10`, color: cfg.color, fontFamily: fontFamily.mono }}>
                      {risk.data_source}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold leading-snug" style={{ color: '#EDF1F7', fontFamily: fontFamily.display }}>
                  {risk.title}
                </p>
              </div>
            </div>

            {/* Detail */}
            <p className="text-xs leading-relaxed mb-1.5 ml-10" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
              {risk.detail}
            </p>

            {/* Evidence */}
            {risk.evidence && (
              <p className="text-[11px] leading-relaxed mb-2 ml-10" style={{ color: '#64748B', fontFamily: fontFamily.body }}>
                {risk.evidence}
              </p>
            )}

            {/* Action */}
            {risk.action && (
              <div className="ml-10 mb-3 p-2 rounded-lg" style={{ background: 'rgba(232,93,0,0.06)', border: '1px solid rgba(232,93,0,0.15)' }}>
                <p className="text-[11px] font-semibold" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>
                  RECOMMENDED ACTION
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#EDF1F7', fontFamily: fontFamily.body }}>
                  {risk.action}
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-2 ml-10">
              <button
                onClick={() => handleAct(risk)}
                disabled={acting === risk.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: '#10B981', color: 'white', fontFamily: fontFamily.body }}
                data-testid={`risk-act-${risk.id}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {acting === risk.id ? 'Recording...' : 'Acting on this'}
              </button>
              <button
                onClick={() => handleDismiss(risk.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{ background: 'transparent', border: '1px solid rgba(140,170,210,0.15)', color: '#64748B', fontFamily: fontFamily.body }}>
                Acknowledged
              </button>
              <a href="/advisor"
                className="flex items-center gap-1 text-xs ml-auto"
                style={{ color: '#E85D00', fontFamily: fontFamily.body }}>
                Ask advisor <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RiskSuggestions;
