import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Clock } from 'lucide-react';
import { colors, radius } from '../../design-system/tokens';

const SEVERITY_STYLE = {
  critical: { bg: `${colors.danger}18`, border: `${colors.danger}55`, text: colors.danger, label: 'Critical' },
  high: { bg: `${colors.danger}12`, border: `${colors.danger}40`, text: colors.danger, label: 'High' },
  warning: { bg: `${colors.warning}18`, border: `${colors.warning}55`, text: colors.warning, label: 'Warning' },
  medium: { bg: `${colors.warning}12`, border: `${colors.warning}40`, text: colors.warning, label: 'Medium' },
  info: { bg: `${colors.info}15`, border: `${colors.info}50`, text: colors.info, label: 'Info' },
  low: { bg: `${colors.success}15`, border: `${colors.success}50`, text: colors.success, label: 'Low' },
};

function formatRelativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  const diff = Date.now() - then.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function WarRoomAlertCard({ alert, onAcknowledge, onDismiss }) {
  const style = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.info;
  const isHandled = alert.status && alert.status !== 'active';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: isHandled ? 0.55 : 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl p-3 border"
      style={{ background: style.bg, borderColor: style.border, borderRadius: radius.cardSm }}
      role="article"
      aria-label={`${style.label} alert: ${alert.headline || 'Untitled'}`}
      data-testid={`war-room-alert-card-${alert.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: style.text }} aria-hidden="true" />
            <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: style.text }}>{style.label}</span>
            {alert.domain && <span className="text-[9px]" style={{ color: colors.textMuted }}>· {alert.domain}</span>}
          </div>
          <h3 className="text-xs font-semibold mb-0.5 break-words leading-snug" style={{ color: colors.text }}>{alert.headline || 'Alert'}</h3>
          {alert.statement && (
            <p className="text-[10px] break-words leading-snug" style={{ color: colors.textSecondary }}>
              {alert.statement.slice(0, 140)}
              {alert.statement.length > 140 ? '…' : ''}
            </p>
          )}
          <div className="flex items-center gap-1 mt-1.5 text-[9px]" style={{ color: colors.textMuted }}>
            <Clock className="w-2.5 h-2.5" aria-hidden="true" />
            <time dateTime={alert.created_at}>{formatRelativeTime(alert.created_at)}</time>
          </div>
        </div>

        {!isHandled && (
          <div className="flex flex-col gap-0.5 flex-shrink-0">
            <button onClick={() => onAcknowledge?.(alert.id)} className="p-1 rounded hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-offset-0" style={{ color: colors.textSecondary }} aria-label={`Acknowledge alert: ${alert.headline}`} data-testid={`war-room-alert-ack-${alert.id}`}>
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDismiss?.(alert.id)} className="p-1 rounded hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-offset-0" style={{ color: colors.textSecondary }} aria-label={`Dismiss alert: ${alert.headline}`} data-testid={`war-room-alert-dismiss-${alert.id}`}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </motion.article>
  );
}
