import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertCircle, AlertTriangle, Info, CheckCircle, ArrowRight } from 'lucide-react';
import useAlerts from '../hooks/useAlerts';

/**
 * AlertStack — Phase 6.5 visible alert rendering.
 *
 * Mounted at the top of DashboardLayout. Renders up to `maxVisible` active
 * alerts from the useAlerts hook as stacked cards.
 *
 * Design:
 *   • Liquid-steel silver gradient (matches the BIQc brand family)
 *   • Severity left-bar indicator (urgent red, warning orange, info ink, success green)
 *   • Geist typography
 *   • Dismiss X (top-right) — negative learning signal
 *   • CTA button — positive learning signal, navigates to cta_href
 *
 * Trust Layer:
 *   • Exit always visible (X button)
 *   • Clear copy, no hype
 *   • Alerts auto-clear when user visits the target page — predictable behaviour
 */

const SEVERITY_STYLES = {
  urgent:  { accent: '#DC2626', Icon: AlertCircle,    accentBg: 'rgba(220,38,38,0.1)' },
  warning: { accent: '#D97706', Icon: AlertTriangle,  accentBg: 'rgba(217,119,6,0.1)' },
  info:    { accent: '#525252', Icon: Info,           accentBg: 'rgba(10,10,10,0.06)' },
  success: { accent: '#16A34A', Icon: CheckCircle,    accentBg: 'rgba(22,163,74,0.1)' },
};

const AlertCard = ({ alert, onDismiss, onAction }) => {
  const navigate = useNavigate();
  const severity = alert.payload?.severity || 'info';
  const { accent, Icon, accentBg } = SEVERITY_STYLES[severity] || SEVERITY_STYLES.info;

  const handleAction = () => {
    const href = alert.payload?.cta_href;
    onAction(alert.id, `clicked:${href || 'no-href'}`);
    if (href) {
      if (href.startsWith('http')) window.open(href, '_blank', 'noopener,noreferrer');
      else navigate(href);
    }
  };

  return (
    <div
      data-testid={`alert-${alert.type}`}
      style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #F6F7F9 0%, #E8ECF1 60%, #DDE3EB 100%)',
        border: '1px solid rgba(10,10,10,0.08)',
        borderLeftWidth: 3,
        borderLeftColor: accent,
        borderRadius: 14,
        padding: '14px 16px 14px 18px',
        boxShadow: '0 4px 14px rgba(10,10,10,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
        fontFamily: 'var(--font-marketing-ui, "Geist", sans-serif)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 32, height: 32, borderRadius: 8,
          background: accentBg, color: accent,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={16} strokeWidth={2} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-marketing-display, "Geist", sans-serif)',
          fontSize: 14, fontWeight: 600,
          color: 'var(--ink-display, #0A0A0A)',
          letterSpacing: '-0.01em',
          lineHeight: 1.3,
          marginBottom: alert.payload?.body ? 4 : 0,
        }}>
          {alert.payload?.title || 'New signal'}
        </div>
        {alert.payload?.body && (
          <div style={{
            fontSize: 12.5,
            color: 'var(--ink-secondary, #525252)',
            lineHeight: 1.5,
            letterSpacing: '-0.003em',
            marginBottom: alert.payload?.cta_label ? 10 : 0,
          }}>
            {alert.payload.body}
          </div>
        )}
        {alert.payload?.cta_label && (
          <button
            onClick={handleAction}
            data-testid={`alert-${alert.type}-cta`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#0A0A0A', color: '#FFFFFF',
              border: '1px solid #0A0A0A',
              borderRadius: 999,
              padding: '7px 14px',
              fontSize: 12.5, fontWeight: 500,
              letterSpacing: '-0.005em',
              cursor: 'pointer',
              fontFamily: 'var(--font-marketing-ui, "Geist", sans-serif)',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#1F1F1F'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#0A0A0A'; }}
          >
            {alert.payload.cta_label}
            <ArrowRight size={12} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(alert.id)}
        aria-label="Dismiss alert"
        data-testid={`alert-${alert.type}-dismiss`}
        style={{
          flexShrink: 0,
          width: 26, height: 26, borderRadius: '50%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ink-muted, #737373)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s, color 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,10,10,0.06)'; e.currentTarget.style.color = 'var(--ink-display, #0A0A0A)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-muted, #737373)'; }}
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
};

const AlertStack = ({ maxVisible = 3, position = 'top' }) => {
  const { alerts, dismiss, action } = useAlerts();

  if (!alerts.length) return null;

  const visible = alerts.slice(0, maxVisible);
  const hidden = alerts.length - visible.length;

  return (
    <div
      data-testid="alert-stack"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginBottom: position === 'top' ? 16 : 0,
        marginTop: position === 'bottom' ? 16 : 0,
      }}
    >
      {visible.map((a) => (
        <AlertCard key={a.id} alert={a} onDismiss={dismiss} onAction={action} />
      ))}
      {hidden > 0 && (
        <div style={{
          fontSize: 11,
          color: 'var(--ink-muted, #737373)',
          fontFamily: 'var(--font-marketing-ui, "Geist", sans-serif)',
          textAlign: 'center',
          letterSpacing: '-0.002em',
        }}>
          + {hidden} more alert{hidden === 1 ? '' : 's'} — review in Settings
        </div>
      )}
    </div>
  );
};

export default AlertStack;
