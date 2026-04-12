import React from 'react';
import { motion } from 'framer-motion';
import { colors, fontFamily, radius } from '../../design-system/tokens';
import InsightExplainabilityStrip from '../InsightExplainabilityStrip';
import LineageBadge from '../LineageBadge';

/* Three bouncing dots for typing indicator */
const typingDotStyle = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: colors.brand,
  display: 'inline-block',
};

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="BIQc is typing" role="status">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={typingDotStyle}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}

/* Avatar circle */
function MessageAvatar({ isUser, userName }) {
  if (isUser) {
    const initials = (userName || 'You')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';
    return (
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-semibold"
        style={{ background: `${colors.brand}25`, color: colors.brand, border: `1px solid ${colors.brand}40` }}
        aria-hidden="true"
      >
        {initials}
      </div>
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold"
      style={{ background: 'linear-gradient(135deg, #E85D00, #C24D00)', color: '#fff' }}
      aria-hidden="true"
    >
      B
    </div>
  );
}

export default function BoardroomMessageBubble({ message, index = 0, streaming = false, userName }) {
  const isUser = message.role === 'user';
  const isAdvisor = message.role === 'advisor';
  const testIdPrefix = isUser ? 'br-msg-user' : 'br-msg-advisor';
  const displayName = isUser ? 'You' : 'BIQc BoardRoom';

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
      role="article"
      aria-label={`${isUser ? 'Your' : 'Advisor'} message`}
      data-testid={`${testIdPrefix}-${index}`}
    >
      {/* AI avatar on left */}
      {!isUser && <div className="mr-2 mt-1"><MessageAvatar isUser={false} /></div>}

      <div
        className="max-w-[85%] rounded-2xl px-4 py-3"
        style={{
          background: isUser ? `${colors.brand}12` : colors.bgCard,
          border: `1px solid ${isUser ? `${colors.brand}30` : colors.border}`,
          borderRadius: radius.card,
        }}
      >
        {/* Name label */}
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: isUser ? colors.brand : colors.textMuted }}>
          {displayName}
        </div>

        {message.focus_area && (
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>
            {message.focus_area.replace(/_/g, ' ')}
          </div>
        )}

        <div className="text-sm whitespace-pre-wrap" style={{ color: colors.text, fontFamily: fontFamily.body, lineHeight: 1.5 }} aria-live={streaming ? 'polite' : undefined}>
          {message.content}
          {streaming && <span className="ml-1"><TypingDots /></span>}
        </div>

        {isAdvisor && message.degraded && (
          <div className="mt-2 text-[10px] px-2 py-1 rounded" style={{ background: `${colors.warning}15`, color: colors.warning }}>
            Resilience mode — limited data confidence
          </div>
        )}

        {isAdvisor && (message.lineage || message.confidence_score != null) && (
          <div className="mt-2">
            <LineageBadge lineage={message.lineage} confidence_score={message.confidence_score} compact />
          </div>
        )}

        {isAdvisor && message.explainability && Object.keys(message.explainability || {}).length > 0 && (
          <div className="mt-3">
            <InsightExplainabilityStrip
              whyVisible={message.explainability.why_visible}
              whyNow={message.explainability.why_now}
              nextAction={message.explainability.next_action}
              ifIgnored={message.explainability.if_ignored}
              testIdPrefix={`${testIdPrefix}-explain-${index}`}
            />
          </div>
        )}

        {isAdvisor && message.evidence_chain?.length > 0 && (
          <div className="mt-2 pt-2 border-t" style={{ borderColor: colors.border }}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>
              Evidence chain
            </div>
            <ul className="space-y-0.5" role="list">
              {message.evidence_chain.slice(0, 5).map((e, i) => (
                <li key={i} className="text-[10px]" style={{ color: colors.textSecondary }}>
                  {e.domain} · {e.event_type} · {e.severity}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* User avatar on right */}
      {isUser && <div className="ml-2 mt-1"><MessageAvatar isUser userName={userName} /></div>}
    </motion.article>
  );
}
