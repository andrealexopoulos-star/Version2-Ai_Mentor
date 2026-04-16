/**
 * PredictionsPanel — Displays AI predictions (churn risk, cash runway, etc.)
 * Used in IntelCentre and can be embedded in other pages.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/api';
import { fontFamily } from '../../design-system/tokens';
import {
  TrendingUp, TrendingDown, AlertTriangle,
  DollarSign, Users, ShoppingCart, Activity,
  RefreshCw, ChevronDown
} from 'lucide-react';

const MODEL_META = {
  churn_risk:         { icon: Users,         label: 'Churn Risk',         color: '#EF4444', inverse: true },
  cash_runway:        { icon: DollarSign,    label: 'Cash Runway',        color: '#22C55E', inverse: false },
  deal_closure:       { icon: ShoppingCart,   label: 'Deal Closure',       color: '#3B82F6', inverse: false },
  demand_trajectory:  { icon: TrendingUp,    label: 'Demand Trajectory',  color: '#8B5CF6', inverse: false },
  attrition_risk:     { icon: AlertTriangle, label: 'Attrition Risk',     color: '#F59E0B', inverse: true },
};

const getScoreColor = (score, inverse) => {
  const s = inverse ? (1 - score) : score;
  if (s >= 0.7) return '#22C55E';
  if (s >= 0.4) return '#F59E0B';
  return '#EF4444';
};

const PredictionsPanel = ({ compact = false }) => {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const fetchPredictions = useCallback(async () => {
    try {
      const res = await apiClient.get('/intelligence/predictions');
      setPredictions(res.data?.predictions || []);
    } catch (e) {
      console.error('[PredictionsPanel] fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPredictions(); }, [fetchPredictions]);

  const runPredictions = async () => {
    setRunning(true);
    try {
      await apiClient.post('/intelligence/predict');
      await fetchPredictions();
    } catch (e) {
      console.error('[PredictionsPanel] predict failed:', e);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
        ))}
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--ink-muted, #708499)' }} />
        <p className="text-sm mb-4" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>
          No predictions generated yet. Run your first analysis to see AI-powered forecasts.
        </p>
        <button onClick={runPredictions} disabled={running}
          className="px-4 py-2 rounded-lg text-sm flex items-center gap-2 mx-auto transition-all hover:opacity-80"
          style={{ background: 'rgba(232, 93, 0, 0.12)', color: '#E85D00', fontFamily: fontFamily.mono }}>
          <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Running models...' : 'Generate predictions'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase tracking-wider" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>
          Predictive Models
        </span>
        <button onClick={runPredictions} disabled={running}
          className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all hover:opacity-80"
          style={{ background: 'rgba(232, 93, 0, 0.08)', color: '#E85D00', fontFamily: fontFamily.mono }}>
          <RefreshCw className={`w-3 h-3 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Running...' : 'Refresh'}
        </button>
      </div>

      <div className={compact ? 'space-y-2' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}>
        {predictions.map(pred => {
          const meta = MODEL_META[pred.model_name] || { icon: Activity, label: pred.model_name, color: '#3B82F6', inverse: false };
          const Icon = meta.icon;
          const score = pred.score || 0;
          const confidence = pred.confidence || 0;
          const scoreColor = getScoreColor(score, meta.inverse);
          const isExpanded = expanded === pred.id;

          return (
            <div key={pred.id || pred.model_name}
              className="p-4 rounded-xl cursor-pointer transition-all hover:translate-y-[-1px]"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
              onClick={() => setExpanded(isExpanded ? null : pred.id)}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${meta.color}15` }}>
                  <Icon className="w-5 h-5" style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.body }}>
                      {meta.label}
                    </span>
                    <span className="text-lg font-semibold" style={{ color: scoreColor, fontFamily: fontFamily.display }}>
                      {(score * 100).toFixed(0)}%
                    </span>
                  </div>
                  {/* Score bar */}
                  <div className="h-1.5 rounded-full mb-2" style={{ background: 'var(--border, rgba(0,0,0,0.06))' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${score * 100}%`, background: scoreColor }} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>
                      {pred.horizon_days}d horizon
                    </span>
                    <span style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>
                      {(confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  {pred.reasoning && (
                    <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>
                      {pred.reasoning}
                    </p>
                  )}
                  {isExpanded && pred.details && Object.keys(pred.details).length > 0 && (
                    <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid var(--border-default)' }}>
                      {Object.entries(pred.details).slice(0, 6).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>{k.replace(/_/g, ' ')}</span>
                          <span style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.mono }}>
                            {typeof v === 'number' ? v.toFixed(2) : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PredictionsPanel;
