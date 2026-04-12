/**
 * ProactiveAlerts — Surfaces AI-detected risks and opportunities
 * before the user asks. Lives on the Advisor page above the signal feed.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/api';
import { fontFamily } from '../../design-system/tokens';
import {
  AlertTriangle, TrendingDown, Users, Clock,
  DollarSign, ShieldAlert, Lightbulb, RefreshCw,
  ChevronRight, X, Eye
} from 'lucide-react';

const ALERT_ICONS = {
  client_silence:    Users,
  deal_stall:        Clock,
  cash_runway:       DollarSign,
  data_freshness:    ShieldAlert,
  meeting_overload:  Clock,
  contradiction:     AlertTriangle,
  opportunity:       Lightbulb,
  counter_narrative: Eye,
  compliance:        ShieldAlert,
  revenue_anomaly:   TrendingDown,
};

const SEVERITY_COLORS = {
  critical: { bg: 'rgba(239, 68, 68, 0.10)', border: '#EF4444', text: '#FCA5A5' },
  high:     { bg: 'rgba(245, 158, 11, 0.10)', border: '#F59E0B', text: '#FCD34D' },
  medium:   { bg: 'rgba(59, 130, 246, 0.08)', border: '#3B82F6', text: '#93C5FD' },
  low:      { bg: 'rgba(34, 197, 94, 0.08)', border: '#22C55E', text: '#86EFAC' },
};

const ProactiveAlerts = ({ userId }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());
  const [expanded, setExpanded] = useState(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await apiClient.get('/intelligence/proactive-alerts');
      setAlerts(res.data?.alerts || []);
    } catch (e) {
      console.error('[ProactiveAlerts] fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const runScan = async () => {
    setScanning(true);
    try {
      await apiClient.post('/intelligence/proactive-scan');
      await fetchAlerts();
    } catch (e) {
      console.error('[ProactiveAlerts] scan failed:', e);
    } finally {
      setScanning(false);
    }
  };

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));
  if (loading) return null;
  if (visibleAlerts.length === 0 && !scanning) return (
    <div className="mb-6 p-4 rounded-xl flex items-center justify-between"
      style={{ background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.15)' }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.15)' }}>
          <Lightbulb className="w-4 h-4" style={{ color: '#22C55E' }} />
        </div>
        <span className="text-sm" style={{ fontFamily: fontFamily.body, color: '#86EFAC' }}>
          No proactive alerts — your business signals are stable
        </span>
      </div>
      <button onClick={runScan} disabled={scanning}
        className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all hover:opacity-80"
        style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#22C55E', fontFamily: fontFamily.mono }}>
        <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
        {scanning ? 'Scanning...' : 'Run scan'}
      </button>
    </div>
  );

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" style={{ color: '#E85D00' }} />
          <span className="text-xs uppercase tracking-wider" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>
            Proactive Intelligence
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(232, 93, 0, 0.12)', color: '#E85D00' }}>
            {visibleAlerts.length}
          </span>
        </div>
        <button onClick={runScan} disabled={scanning}
          className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all hover:opacity-80"
          style={{ background: 'rgba(232, 93, 0, 0.08)', color: '#E85D00', fontFamily: fontFamily.mono }}>
          <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning...' : 'Rescan'}
        </button>
      </div>

      <div className="space-y-2">
        {visibleAlerts.slice(0, 5).map(alert => {
          const severity = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.medium;
          const Icon = ALERT_ICONS[alert.action_type?.replace('proactive_alert_', '')] || AlertTriangle;
          const isExpanded = expanded === alert.id;

          return (
            <div key={alert.id}
              className="p-3 rounded-xl cursor-pointer transition-all hover:translate-x-0.5"
              style={{ background: severity.bg, border: `1px solid ${severity.border}25` }}
              onClick={() => setExpanded(isExpanded ? null : alert.id)}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${severity.border}20` }}>
                  <Icon className="w-4 h-4" style={{ color: severity.border }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium truncate" style={{ color: severity.text, fontFamily: fontFamily.body }}>
                      {alert.title}
                    </span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: `${severity.border}15`, color: severity.border, fontFamily: fontFamily.mono }}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#8FA0B8', fontFamily: fontFamily.body }}>
                    {alert.description}
                  </p>
                  {isExpanded && alert.metadata && (
                    <div className="mt-3 pt-3 space-y-1" style={{ borderTop: `1px solid ${severity.border}15` }}>
                      {Object.entries(alert.metadata).slice(0, 4).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-xs">
                          <span style={{ color: '#708499', fontFamily: fontFamily.mono }}>{k.replace(/_/g, ' ')}</span>
                          <span style={{ color: severity.text, fontFamily: fontFamily.mono }}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); setDismissed(prev => new Set([...prev, alert.id])); }}
                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5">
                    <X className="w-3 h-3" style={{ color: '#708499' }} />
                  </button>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} style={{ color: '#708499' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProactiveAlerts;
