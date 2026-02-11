import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../context/SupabaseAuthContext';

const POSITION_COLORS = {
  STABLE: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)', text: '#4ade80', dot: '#22c55e' },
  ELEVATED: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: '#fbbf24', dot: '#f59e0b' },
  DETERIORATING: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', text: '#f87171', dot: '#ef4444' },
  CRITICAL: { bg: 'rgba(220,38,38,0.12)', border: 'rgba(220,38,38,0.4)', text: '#fca5a5', dot: '#dc2626' },
};

const DEFAULT_STYLE = { bg: 'rgba(100,100,100,0.05)', border: 'rgba(100,100,100,0.15)', text: '#9ca3af', dot: '#6b7280' };

const getActionText = (item) => {
  if (!item) return null;
  if (item.window_days !== null && item.window_days !== undefined) return `${item.window_days}d decision window`;
  if (item.pressure_level === 'CRITICAL') return 'Immediate action required';
  if (item.pressure_level === 'HIGH') return 'Action required';
  if (item.has_contradiction) return 'Alignment gap detected';
  if (item.position === 'DETERIORATING') return 'Trend worsening';
  if (item.position === 'ELEVATED') return 'Monitor';
  return null;
};

const BoardRoom = () => {
  const navigate = useNavigate();
  const [positions, setPositions] = useState({});
  const [escalations, setEscalations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [priorityCompression, setPriorityCompression] = useState(null);
  const [expandedEvidence, setExpandedEvidence] = useState(new Set());
  const [showCollapsed, setShowCollapsed] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const toggleEvidence = (domain) => {
    setExpandedEvidence(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  // Session check
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) setSessionReady(!!session);
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!cancelled) setSessionReady(!!s);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  // Load positions + auto-brief on mount
  useEffect(() => {
    if (!sessionReady || initialized) return;
    const init = async () => {
      await loadPositions();
      await sendMessage('[BOARD_ROOM_INIT]', true);
      setInitialized(true);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const loadPositions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/watchtower/positions`, {
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Accept': 'application/json' },
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        setPositions(data.positions || {});
      }
    } catch (e) {
      console.error('[BoardRoom] Failed to load positions:', e);
    }
  };

  const sendMessage = async (text, isHidden = false) => {
    if (!text.trim()) return;
    if (!isHidden) {
      setMessages(prev => [...prev, { role: 'user', content: text }]);
    }
    setInput('');
    setIsProcessing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsProcessing(false);
        return;
      }

      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/boardroom/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          history: messages.filter(m => m.role !== 'system'),
        }),
      });

      if (!res.ok) throw new Error('Board Room connection failed');
      const data = await res.json();

      if (data.response) {
        setMessages(prev => [...prev, { role: 'authority', content: data.response }]);
      }
      if (data.escalations) {
        setEscalations(data.escalations);
      }
      if (data.priority_compression) {
        setPriorityCompression(data.priority_compression);
      }

      await loadPositions();
    } catch (err) {
      console.error('[BoardRoom] Error:', err);
      setMessages(prev => [...prev, {
        role: 'authority',
        content: 'Intelligence link disrupted. Reconnect and retry.',
      }]);
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!isProcessing && input.trim()) sendMessage(input);
  };

  const handleEscalationAction = async (domain, action) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/boardroom/escalation-action`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain, action }),
      });
      if (res.ok) {
        setEscalations(prev => prev.map(e =>
          e.domain === domain ? { ...e, last_user_action: action } : e
        ));
      }
    } catch (err) {
      console.error('[BoardRoom] Escalation action failed:', err);
    }
  };

  const actionableEscalations = escalations.filter(e => e.last_user_action === 'unknown');
  const pc = priorityCompression;
  const positionEntries = Object.entries(positions);
  const hasFallbackPositions = !pc && positionEntries.length > 0;

  const renderDomainCard = (item, isPrimary) => {
    if (!item) return null;
    const s = POSITION_COLORS[item.position] || DEFAULT_STYLE;
    const isExpanded = expandedEvidence.has(item.domain);
    const action = getActionText(item);

    return (
      <div
        key={item.domain}
        data-testid={`domain-${isPrimary ? 'primary' : 'secondary'}-${item.domain}`}
        style={{
          padding: isPrimary ? '16px 20px' : '12px 16px',
          borderLeft: `3px solid ${s.dot}`,
          background: s.bg,
          flex: isPrimary ? 'unset' : '1',
          minWidth: isPrimary ? 'unset' : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0, boxShadow: `0 0 6px ${s.dot}` }} />
            <span style={{ fontSize: isPrimary ? 12 : 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontWeight: 500 }}>{item.domain}</span>
          </div>
          <span style={{ fontSize: isPrimary ? 11 : 10, letterSpacing: '0.15em', color: s.text, fontWeight: 600 }}>{item.position}</span>
        </div>
        {action && (
          <div style={{ marginTop: 8, fontSize: isPrimary ? 12 : 10, letterSpacing: '0.1em', color: s.text, opacity: 0.9 }}>{action}</div>
        )}
        {item.finding && (
          <div style={{ marginTop: isPrimary ? 10 : 6 }}>
            <button
              data-testid={`evidence-toggle-${item.domain}`}
              onClick={() => toggleEvidence(item.domain)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.25)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', fontSize: 8 }}>&#9654;</span>
              EVIDENCE
            </button>
            {isExpanded && (
              <div style={{ marginTop: 6, fontSize: isPrimary ? 12 : 11, lineHeight: 1.6, color: 'rgba(255,255,255,0.5)', paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                {item.finding}
              </div>
            )}
          </div>
        )}
        {isPrimary && item.has_contradiction && (
          <div style={{ marginTop: 8, fontSize: 10, letterSpacing: '0.1em', color: '#fbbf24', opacity: 0.8 }}>
            {item.contradiction_count} contradiction{item.contradiction_count > 1 ? 's' : ''} detected
          </div>
        )}
      </div>
    );
  };

  return (
    <div data-testid="board-room" style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#050505', color: '#e5e7eb', fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif", overflow: 'hidden' }}>
      <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 0, opacity: 0.03, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />

      {/* HEADER */}
      <header style={{ position: 'relative', zIndex: 5, padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#050505', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>BIQC</div>
          <div style={{ fontSize: 15, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginTop: 2 }}>BOARD ROOM</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.2)' }}>{new Date().toISOString().slice(0, 10)}</span>
          <button data-testid="boardroom-home" onClick={() => navigate('/advisor')} style={{ fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 12px', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'rgba(255,255,255,0.6)'} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.3)'}>HOME</button>
        </div>
      </header>

      {/* PRIORITY COMPRESSION VIEW */}
      {pc && (
        <div data-testid="priority-compression" style={{ position: 'relative', zIndex: 5, borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {pc.primary && (
            <div data-testid="primary-focus-section" style={{ borderBottom: pc.secondary?.length ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.2)', padding: '10px 20px 0', textTransform: 'uppercase' }}>PRIMARY FOCUS</div>
              {renderDomainCard(pc.primary, true)}
            </div>
          )}
          {pc.secondary?.length > 0 && (
            <div data-testid="secondary-section" style={{ display: 'flex', gap: 1, borderBottom: pc.collapsed?.length ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              {pc.secondary.map(item => renderDomainCard(item, false))}
            </div>
          )}
          {pc.collapsed?.length > 0 && (
            <div data-testid="collapsed-section" style={{ padding: '0 20px' }}>
              <button data-testid="show-collapsed-btn" onClick={() => setShowCollapsed(!showCollapsed)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', fontFamily: 'inherit', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ transition: 'transform 0.2s', transform: showCollapsed ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', fontSize: 8 }}>&#9654;</span>
                {pc.collapsed.length} MORE DOMAIN{pc.collapsed.length > 1 ? 'S' : ''}
              </button>
              {showCollapsed && (
                <div style={{ display: 'flex', gap: 1, paddingBottom: 6 }}>
                  {pc.collapsed.map(item => renderDomainCard(item, false))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* FALLBACK POSITION STRIP (before compression data arrives) */}
      {hasFallbackPositions && (
        <div data-testid="position-strip" style={{ position: 'relative', zIndex: 5, display: 'flex', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, overflowX: 'auto' }}>
          {positionEntries.map(([domain, data]) => {
            const st = POSITION_COLORS[data.position] || DEFAULT_STYLE;
            return (
              <div key={domain} data-testid={`position-${domain}`} style={{ padding: '10px 14px', border: `1px solid ${st.border}`, background: st.bg, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.dot, flexShrink: 0, boxShadow: `0 0 6px ${st.dot}` }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>{domain}</div>
                  <div style={{ fontSize: 12, letterSpacing: '0.15em', color: st.text, fontWeight: 600 }}>{data.position}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BRIEFING AREA */}
      <div style={{ position: 'relative', zIndex: 5, flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {!sessionReady && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, letterSpacing: '0.2em' }}>ESTABLISHING AUTHORITY LINK...</span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ maxWidth: '90%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'authority' ? (
              <div data-testid={`authority-message-${i}`}>
                <div style={{ fontSize: 9, letterSpacing: '0.25em', marginBottom: 6, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>BOARD ROOM</div>
                <div style={{ fontSize: 14, lineHeight: 1.8, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: 16 }}>{msg.content}</div>
              </div>
            ) : (
              <div data-testid={`user-message-${i}`}>
                <div style={{ fontSize: 9, letterSpacing: '0.25em', marginBottom: 6, color: 'rgba(255,255,255,0.15)', textTransform: 'uppercase', textAlign: 'right' }}>OPERATOR</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.5)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderRight: '2px solid rgba(255,255,255,0.06)', paddingRight: 16, textAlign: 'right' }}>{msg.content}</div>
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div style={{ maxWidth: '90%', alignSelf: 'flex-start' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.25em', marginBottom: 6, color: 'rgba(255,255,255,0.2)' }}>BOARD ROOM</div>
            <div style={{ borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', animation: 'brDot 1.4s infinite' }} />
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', animation: 'brDot 1.4s infinite 0.2s' }} />
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', animation: 'brDot 1.4s infinite 0.4s' }} />
              <span style={{ marginLeft: 10, color: 'rgba(255,255,255,0.15)', fontSize: 10, letterSpacing: '0.2em' }}>EVALUATING</span>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* ESCALATION ACTIONS */}
      {actionableEscalations.length > 0 && (
        <div data-testid="escalation-actions" style={{ position: 'relative', zIndex: 5, padding: '10px 24px', borderTop: '1px solid rgba(255,255,255,0.04)', background: '#050505', flexShrink: 0 }}>
          {actionableEscalations.map(esc => (
            <div key={esc.domain} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ fontSize: 11, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>{esc.domain} — {esc.position}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button data-testid={`acknowledge-${esc.domain}`} onClick={() => handleEscalationAction(esc.domain, 'acknowledged')} style={{ fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)', padding: '4px 14px', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }} onMouseEnter={e => { e.target.style.borderColor = 'rgba(255,255,255,0.3)'; e.target.style.color = 'rgba(255,255,255,0.8)'; }} onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.color = 'rgba(255,255,255,0.5)'; }}>ACKNOWLEDGE</button>
                <button data-testid={`defer-${esc.domain}`} onClick={() => handleEscalationAction(esc.domain, 'deferred')} style={{ fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)', padding: '4px 14px', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }} onMouseEnter={e => { e.target.style.borderColor = 'rgba(255,255,255,0.2)'; e.target.style.color = 'rgba(255,255,255,0.6)'; }} onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.color = 'rgba(255,255,255,0.3)'; }}>DEFER</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INPUT */}
      <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 5, padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#050505', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(255,255,255,0.08)', padding: '8px 14px', background: 'rgba(255,255,255,0.02)' }}>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12, userSelect: 'none' }}>{'>'}</span>
          <input ref={inputRef} data-testid="boardroom-input" type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="" disabled={isProcessing || !sessionReady} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'rgba(255,255,255,0.6)', fontFamily: 'inherit', fontSize: 13, letterSpacing: '0.03em', opacity: isProcessing ? 0.3 : 1 }} />
          <button type="submit" data-testid="boardroom-submit" disabled={isProcessing || !input.trim() || !sessionReady} style={{ padding: '5px 16px', fontFamily: 'inherit', fontSize: 10, letterSpacing: '0.2em', fontWeight: 500, color: '#050505', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', opacity: (isProcessing || !input.trim()) ? 0.2 : 1, transition: 'opacity 0.2s' }}>SUBMIT</button>
        </div>
      </form>

      <style>{`
        @keyframes brDot {
          0%, 80%, 100% { opacity: 0.15; }
          40% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default BoardRoom;
