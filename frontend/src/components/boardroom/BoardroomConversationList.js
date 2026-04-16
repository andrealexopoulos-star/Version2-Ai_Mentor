import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, MessageSquare, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { colors, fontFamily } from '../../design-system/tokens';

function groupConversations(conversations) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - 7);

  const groups = { today: [], yesterday: [], week: [], older: [] };
  for (const conv of conversations || []) {
    const ts = new Date(conv.last_message_at || conv.updated_at || conv.created_at);
    if (ts >= startToday) groups.today.push(conv);
    else if (ts >= startYesterday) groups.yesterday.push(conv);
    else if (ts >= startWeek) groups.week.push(conv);
    else groups.older.push(conv);
  }
  return groups;
}

export default function BoardroomConversationList({
  mode = 'boardroom',
  conversations = [],
  activeConvId = null,
  onSelect,
  onNewSession,
  collapsed = false,
  onToggle,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.focus_area || '').toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);
  const groups = groupConversations(filteredConversations);
  const sections = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['older', 'Older']];
  const modeLabel = mode === 'boardroom' ? 'Boardroom' : 'War Room';

  if (collapsed) {
    return (
      <aside className="w-12 flex flex-col items-center py-3 border-r" style={{ borderColor: colors.border, background: colors.bgSidebar }}>
        <button onClick={() => onToggle(false)} className="p-2 rounded hover:bg-black/5 transition-colors focus-visible:ring-2" aria-label="Expand conversation sidebar" aria-expanded="false" data-testid="boardroom-sidebar-toggle">
          <ChevronRight className="w-4 h-4" style={{ color: colors.textSecondary }} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[260px] flex flex-col border-r" style={{ borderColor: colors.border, background: colors.bgSidebar }} aria-label={`${modeLabel} conversations`} data-testid="boardroom-conversation-list">
      <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: colors.border }}>
        <h2 className="text-sm font-semibold" style={{ color: colors.text, fontFamily: fontFamily.display }}>{modeLabel}</h2>
        <button onClick={() => onToggle(true)} className="p-1.5 rounded hover:bg-black/5 transition-colors focus-visible:ring-2" aria-label="Collapse conversation sidebar" aria-expanded="true" data-testid="boardroom-sidebar-toggle">
          <ChevronLeft className="w-4 h-4" style={{ color: colors.textSecondary }} />
        </button>
      </div>

      <div className="p-3">
        <button onClick={onNewSession} className="w-full inline-flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ background: colors.brand, color: colors.text }} aria-label={`Start new ${modeLabel.toLowerCase()} session`} data-testid="boardroom-new-session-btn">
          <Plus className="w-4 h-4" />
          New session
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: colors.textMuted }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-1"
            style={{
              background: colors.bgInput,
              borderColor: colors.border,
              color: colors.text,
              fontFamily: fontFamily.body,
            }}
            aria-label="Search conversations"
            data-testid="boardroom-conversation-search"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ul role="list" className="px-2 pb-4 space-y-4">
          {sections.map(([key, label]) => {
            if (!groups[key]?.length) return null;
            return (
              <li key={key}>
                <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>{label}</h3>
                <ul role="list" className="space-y-0.5">
                  {groups[key].map((conv) => {
                    const isActive = conv.id === activeConvId;
                    return (
                      <motion.li key={conv.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }}>
                        <button
                          onClick={() => onSelect(conv.id)}
                          className="w-full text-left px-2 py-2 rounded-lg transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-offset-0"
                          style={{ background: isActive ? `${colors.brand}15` : 'transparent', borderLeft: isActive ? `2px solid ${colors.brand}` : '2px solid transparent' }}
                          aria-label={`Open conversation: ${conv.title || 'Untitled'}`}
                          aria-current={isActive ? 'page' : undefined}
                          data-testid={`boardroom-conversation-item-${conv.id}`}
                        >
                          <div className="flex items-start gap-2">
                            <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: isActive ? colors.brand : colors.textMuted }} />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium truncate" style={{ color: colors.text }}>{conv.title || 'Untitled'}</div>
                              {conv.focus_area && <div className="text-[10px] truncate" style={{ color: colors.textMuted }}>{conv.focus_area.replace(/_/g, ' ')}</div>}
                              <div className="text-[10px] mt-0.5" style={{ color: colors.textMuted }}>{conv.message_count || 0} msg</div>
                            </div>
                          </div>
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
          {!conversations.length && (
            <li className="px-3 py-6 text-center text-xs" style={{ color: colors.textMuted }}>
              No sessions yet. Start a new one above.
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}
