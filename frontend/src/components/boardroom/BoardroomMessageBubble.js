import React from 'react';
import { motion } from 'framer-motion';
import { colors, fontFamily, radius } from '../../design-system/tokens';
import InsightExplainabilityStrip from '../InsightExplainabilityStrip';
import LineageBadge from '../LineageBadge';

export default function BoardroomMessageBubble({ message, index = 0, streaming = false }) {
  const isUser = message.role === 'user';
  const isAdvisor = message.role === 'advisor';
  const testIdPrefix = isUser ? 'br-msg-user' : 'br-msg-advisor';

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
      <div
        className="max-w-[85%] rounded-2xl px-4 py-3"
        style={{
          background: isUser ? `${colors.brand}12` : colors.bgCard,
          border: `1px solid ${isUser ? `${colors.brand}30` : colors.border}`,
          borderRadius: radius.card,
        }}
      >
        {message.focus_area && (
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>
            {message.focus_area.replace(/_/g, ' ')}
          </div>
        )}

        <div className="text-sm whitespace-pre-wrap" style={{ color: colors.text, fontFamily: fontFamily.body, lineHeight: 1.5 }} aria-live={streaming ? 'polite' : undefined}>
          {message.content}
          {streaming && <span className="inline-block w-1 h-4 ml-0.5 animate-pulse" style={{ background: colors.brand }} />}
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
    </motion.article>
  );
}
