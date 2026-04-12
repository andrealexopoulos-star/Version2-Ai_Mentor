/**
 * ProactiveInsightBubble
 *
 * Polls /api/soundboard/proactive-check every 3 minutes while user is online.
 * When a new signal is detected, shows a floating insight card that the user
 * can act on, dismiss, or take to the Soundboard for deeper analysis.
 *
 * This is what makes BIQc feel alive — it surfaces insights WITHOUT being asked.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle, TrendingDown, Calendar, Mail, DollarSign, ArrowRight, Zap } from 'lucide-react';
import { apiClient } from '../lib/api';
import { fontFamily } from '../design-system/tokens';

const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const DISMISSED_KEY = 'biqc_dismissed_proactive';

const ICON_MAP = {
  alert:        { icon: AlertTriangle, color: '#EF4444' },
  deal:         { icon: TrendingDown,  color: '#E85D00' },
  calendar:     { icon: Calendar,      color: '#3B82F6' },
  email:        { icon: Mail,          color: '#8B5CF6' },
  cash:         { icon: DollarSign,    color: '#EF4444' },
  default:      { icon: Zap,           color: '#E85D00' },
};

const PRIORITY_COLORS = {
  critical: '#EF4444',
  high:     '#E85D00',
  medium:   '#F59E0B',
  low:      '#64748B',
};

export const ProactiveInsightBubble = () => {
  const [insight, setInsight] = useState(null);
  const [visible, setVisible] = useState(false);
  const [animIn, setAnimIn] = useState(false);
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  // Load dismissed set from sessionStorage
  const getDismissed = () => {
    try { return new Set(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]')); }
    catch { return new Set(); }
  };

  const addDismissed = (key) => {
    const s = getDismissed(); s.add(key);
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...s]));
  };

  const poll = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const res = await apiClient.get('/soundboard/proactive-check', { timeout: 8000 });
      const data = res.data;
      if (!data?.has_insight || !data.insights?.length) return;

      const dismissed = getDismissed();
      const fresh = data.insights.find(i => !dismissed.has(`${i.type}:${i.title}`));
      if (!fresh) return;

      if (!mountedRef.current) return;
      setInsight(fresh);
      setVisible(true);
      setTimeout(() => setAnimIn(true), 50);

      // Auto-dismiss after 90 seconds if not interacted with
      timerRef.current = setTimeout(() => handleDismiss(fresh), 90000);
    } catch { /* silent — don't break the app if polling fails */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    // Initial poll after 30s (give app time to load)
    const initialTimer = setTimeout(poll, 30000);
    // Then every 3 minutes
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [poll]);

  const handleDismiss = (ins = insight) => {
    if (ins) addDismissed(`${ins.type}:${ins.title}`);
    setAnimIn(false);
    setTimeout(() => { setVisible(false); setInsight(null); }, 300);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleAsk = () => {
    if (!insight) return;
    handleDismiss();
    // Pre-fill Soundboard with the insight context
    const query = `Tell me more about this: ${insight.title}. ${insight.message}`;
    sessionStorage.setItem('biqc_soundboard_prefill', query);
    navigate('/soundboard');
  };

  if (!visible || !insight) return null;

  const { icon: Icon, color } = ICON_MAP[insight.icon] || ICON_MAP.default;
  const priorityColor = PRIORITY_COLORS[insight.priority] || '#E85D00';

  return (
    <div
      className="fixed z-[9999]"
      style={{
        bottom: 88,
        right: 24,
        maxWidth: 340,
        transform: animIn ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
        opacity: animIn ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease',
      }}
      data-testid="proactive-insight-bubble">

      <div className="rounded-2xl overflow-hidden"
        style={{
          background: '#0F1720',
          border: `1px solid ${priorityColor}30`,
          boxShadow: `0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px ${priorityColor}20`,
        }}>

        {/* Priority strip */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${priorityColor}, transparent)` }} />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}15` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-widest"
                    style={{ color: priorityColor, fontFamily: fontFamily.mono }}>
                    {insight.priority} priority
                  </span>
                  <span className="text-[9px]" style={{ color: '#4A5568', fontFamily: fontFamily.mono }}>
                    · {insight.source}
                  </span>
                </div>
                <p className="text-sm font-semibold leading-snug" style={{ color: '#EDF1F7', fontFamily: fontFamily.display }}>
                  {insight.title}
                </p>
              </div>
            </div>
            <button onClick={() => handleDismiss()} className="p-1 rounded-lg hover:bg-white/5 flex-shrink-0"
              style={{ color: '#4A5568' }}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Message */}
          <p className="text-xs leading-relaxed mb-3"
            style={{ color: '#9FB0C3', fontFamily: fontFamily.body, marginLeft: 44 }}>
            {insight.message}
          </p>

          {/* Action */}
          {insight.action && (
            <div className="ml-11 mb-3 px-3 py-2 rounded-lg"
              style={{ background: `${priorityColor}08`, border: `1px solid ${priorityColor}20` }}>
              <p className="text-[10px]" style={{ color: priorityColor, fontFamily: fontFamily.body }}>
                <span className="font-semibold">Recommended: </span>{insight.action}
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-2 ml-11">
            <button onClick={handleAsk}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
              style={{ background: '#E85D00', color: 'white', fontFamily: fontFamily.body }}
              data-testid="proactive-ask-soundboard">
              Ask BIQc <ArrowRight className="w-3 h-3" />
            </button>
            <button onClick={() => handleDismiss()}
              className="px-3 py-1.5 rounded-lg text-xs transition-all"
              style={{ background: 'transparent', border: '1px solid rgba(140,170,210,0.15)', color: '#64748B', fontFamily: fontFamily.body }}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProactiveInsightBubble;
