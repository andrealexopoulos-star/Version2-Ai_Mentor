import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { trackEvent, EVENTS } from '../lib/analytics';
import { Zap, ArrowRight, TrendingDown, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


/**
 * DailyBriefCard — Rendered on the Advisor page.
 * Fetches brief from backend cognition. UI only renders.
 */
export const DailyBriefCard = () => {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBrief = async () => {
      try {
        // Try cognition overview for daily brief data
        const res = await apiClient.get('/cognition/overview');
        const data = res.data;
        if (data && data.status !== 'MIGRATION_REQUIRED') {
          const briefData = {
            priority_domain: data.top_risk_domain || data.highest_instability_domain || null,
            priority_message: data.priority_action || data.executive_summary || null,
            suggested_action: data.suggested_action || null,
            instability_changes: data.overnight_changes || [],
            alerts_count: data.alerts_triggered || 0,
            integration_health: data.integration_health_status || 'unknown',
            truth_states: {
              crm: data?.tab_data?.crm_state || data?.integrations?.crm_state || null,
              accounting: data?.tab_data?.accounting_state || data?.integrations?.accounting_state || null,
              email: data?.tab_data?.email_state || data?.integrations?.email_state || null,
            },
          };
          if (briefData.priority_message || briefData.priority_domain) {
            setBrief(briefData);
          }
        }
      } catch {
        // Cognition not available — try snapshot fallback
        try {
          const snapRes = await apiClient.get('/snapshot/latest');
          const cognitive = snapRes.data?.cognitive;
          if (cognitive) {
            const rq = cognitive.resolution_queue || [];
            const highPriority = rq.find(r => r.severity === 'high' || r.priority === 'high');
            if (highPriority || cognitive.executive_memo) {
              setBrief({
                priority_domain: highPriority?.domain || 'general',
                priority_message: highPriority?.title || cognitive.executive_memo?.substring(0, 120) || 'Review your business intelligence.',
                suggested_action: highPriority?.recommendation || 'Open Ask BIQc for detailed analysis.',
                alerts_count: rq.length,
                truth_states: {
                  crm: cognitive?.integrations?.crm_state || null,
                  accounting: cognitive?.integrations?.accounting_state || null,
                  email: cognitive?.integrations?.email_state || null,
                },
              });
            }
          }
        } catch {}
      } finally {
        setLoading(false);
      }
    };
    fetchBrief();
  }, []);

  if (loading || !brief || dismissed) return null;

  const degradedTruth = Object.entries(brief.truth_states || {}).filter(([, state]) => state && state !== 'live');

  const handleOpen = () => {
    trackEvent(EVENTS.DAILY_BRIEF_OPEN, { domain: brief.priority_domain });
    navigate('/soundboard');
  };

  return (
    <div
      className="rounded-xl p-5 mb-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0E1628 0%, #0E1628 100%)',
        border: '1px solid #E85D0030',
        boxShadow: '0 4px 24px rgba(232, 93, 0, 0.08)',
      }}
      data-testid="daily-brief-card"
    >
      {/* Dismiss button */}
      <button
        onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/5"
        style={{ color: '#64748B' }}
        data-testid="dismiss-brief"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Accent bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, #E85D00, #FF8C33, transparent)' }} />

      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#E85D0015' }}>
          <Zap className="w-5 h-5" style={{ color: '#E85D00' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>
            Today's Priority
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.body }}>
            {brief.priority_message}
          </p>
          {brief.suggested_action && (
            <p className="text-xs mt-2" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>
              Suggested: {brief.suggested_action}
            </p>
          )}
          <button
            onClick={handleOpen}
            className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-[#E85D00]/10"
            style={{ color: '#E85D00', fontFamily: fontFamily.mono, border: '1px solid #E85D0030' }}
            data-testid="open-brief-btn"
          >
            Open Brief <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Metadata row */}
      {(brief.alerts_count > 0 || brief.priority_domain || degradedTruth.length > 0) && (
        <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: '1px solid var(--biqc-border)' }}>
          {brief.priority_domain && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#E85D0010', color: '#E85D00', fontFamily: fontFamily.mono }}>
              {brief.priority_domain}
            </span>
          )}
          {brief.alerts_count > 0 && (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>
              <AlertTriangle className="w-3 h-3" /> {brief.alerts_count} alert{brief.alerts_count !== 1 ? 's' : ''}
            </span>
          )}
          {degradedTruth.length > 0 && (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#FDE68A', fontFamily: fontFamily.mono }} data-testid="daily-brief-truth-state">
              <AlertTriangle className="w-3 h-3" /> Truth gate: {degradedTruth.map(([domain, state]) => `${domain} (${state})`).join(', ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * DailyBriefBanner — Login banner. Shows when brief is available.
 * Displayed at the top of the dashboard after login.
 */
export const DailyBriefBanner = ({ onOpen }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if brief was shown today
    const today = new Date().toISOString().split('T')[0];
    const lastShown = sessionStorage.getItem('biqc_brief_banner_shown');
    if (lastShown !== today) {
      setVisible(true);
      sessionStorage.setItem('biqc_brief_banner_shown', today);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed top-14 left-0 right-0 z-40 flex items-center justify-center px-4 py-3"
      style={{ background: '#E85D0010', borderBottom: '1px solid #E85D0030', backdropFilter: 'blur(8px)' }}
      data-testid="daily-brief-banner"
    >
      <div className="pointer-events-auto flex items-center gap-3 max-w-xl">
        <Zap className="w-4 h-4 shrink-0" style={{ color: '#E85D00' }} />
        <p className="text-sm" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.body }}>
          Your Business Brief is ready.
        </p>
        <button
          onClick={() => { setVisible(false); onOpen?.(); }}
          className="px-3 py-1 rounded-lg text-xs font-semibold shrink-0"
          style={{ background: '#E85D00', color: 'white', fontFamily: fontFamily.mono }}
          data-testid="view-brief-btn"
        >
          View
        </button>
        <button
          onClick={() => setVisible(false)}
          className="p-1 hover:bg-white/5 rounded"
          data-testid="dismiss-banner"
        >
          <X className="w-3.5 h-3.5" style={{ color: '#64748B' }} />
        </button>
      </div>
    </div>
  );
};

export default DailyBriefCard;
