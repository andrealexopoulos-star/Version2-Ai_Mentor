import React, { useState, useEffect, useRef, Component } from 'react';
import { supabase } from '../context/SupabaseAuthContext';
import { getBackendUrl } from '../config/urls';

/* ─── Error Boundary ─── */
class WarRoomErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-[#0a0a0a] text-amber-500 font-mono">
          <div className="text-center space-y-3">
            <p className="text-xs tracking-widest text-amber-700">⚠ SYSTEM FAULT</p>
            <p className="text-sm text-amber-400">War Room failed to initialize.</p>
            <button onClick={() => this.setState({ hasError: false })} className="text-xs border border-amber-800 px-4 py-1 hover:bg-amber-900/20">
              RETRY
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const WarRoomConsoleInner = () => {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [status, setStatus] = useState('ACTIVE');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [sessionReady, setSessionReady] = useState(false);
  const [initError, setInitError] = useState(null);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [contextResolved, setContextResolved] = useState(false);
  const [actions, setActions] = useState([]);
  const [actionsOpen, setActionsOpen] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Resolve workspace context + business intelligence
  useEffect(() => {
    let cancelled = false;
    const resolveContext = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;
        setSessionReady(true);
        const headers = { 'Authorization': `Bearer ${session.access_token}`, 'Accept': 'application/json', 'Cache-Control': 'no-cache' };

        // Fetch lifecycle state
        const res = await fetch(`${getBackendUrl()}/api/lifecycle/state`, { headers });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const lc = await res.json();
          if (lc.workspace_id) setWorkspaceId(lc.workspace_id);
          // If console is already COMPLETED, skip the 17-question flow
          if (lc.console?.status === 'COMPLETED' || lc.console?.status === 'COMPLETE') {
            setStatus('COMPLETE');
            setProgress(100);
            setCurrentStep(17);
          }
        }

        // Fetch business_profiles — if business_stage exists, skip entire 17-point survey
        try {
          const bpRes = await fetch(`${getBackendUrl()}/api/business-profile`, { headers });
          const bpCt = bpRes.headers.get('content-type') || '';
          if (bpRes.ok && bpCt.includes('application/json')) {
            const bp = await bpRes.json();
            const profile = bp.profile || bp;
            if (profile.business_stage) {
              // business_stage known — skip entire 17-point manual survey, go to Intelligence
              setStatus('COMPLETE');
              setProgress(100);
              setCurrentStep(17);
            }
          }
        } catch (bpErr) {
          console.warn('[Console] business_profiles fetch failed:', bpErr.message);
        }

        // Fetch intelligence actions for the signal panel
        fetchActions();

        if (!cancelled) setContextResolved(true);
      } catch (e) {
        console.warn('[Console] Context resolution failed:', e.message);
        if (!cancelled) { setSessionReady(true); setContextResolved(true); }
      }
    };
    resolveContext();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setSessionReady(!!session);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  // Init conversation only when context is resolved — always fresh start
  useEffect(() => {
    if (!sessionReady || !contextResolved) return;
    if (history.length === 0) {
      processMessage('[SYSTEM_INIT_STRATEGY]', true);
    }
    fetchActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, contextResolved]);

  const fetchActions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${getBackendUrl()}/api/intelligence/actions`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActions(data.actions || []);
        if (data.actions?.length > 0) setActionsOpen(true);
      }
    } catch {}
  };

  const toggleAction = async (actionId, newStatus) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`${getBackendUrl()}/api/intelligence/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: newStatus } : a));
    } catch {}
  };

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isThinking]);

  // Persist step to DB (fire-and-forget)
  const persistStep = async (step, stepStatus) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`${getBackendUrl()}/api/console/state`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' },
        body: JSON.stringify({ current_step: step, status: stepStatus }),
      });
    } catch {}
  };

  const processMessage = async (text, isHidden = false) => {
    if (!text.trim()) return;
    if (!isHidden) setHistory(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsThinking(true);
    setInitError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setInitError('Session expired. Please refresh the page.');
        setIsThinking(false);
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/calibration/brain`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          message: text,
          history: history.filter(m => m.role !== 'system'),
        }),
      });

      const ct = response.headers.get('content-type') || '';
      if (!response.ok || !ct.includes('application/json')) throw new Error('Strategy Connection Failed');
      const data = await response.json();

      if (data.message) setHistory(prev => [...prev, { role: 'assistant', content: data.message }]);
      if (data.percentage_complete) setProgress(data.percentage_complete);
      if (data.current_step_number) {
        setCurrentStep(data.current_step_number);
        persistStep(data.current_step_number, data.status || 'IN_PROGRESS');
      }
      if (data.status === 'COMPLETE') setStatus('COMPLETE');
    } catch (error) {
      console.error('Watchtower Error:', error);
      setHistory(prev => [...prev, { role: 'assistant', content: '⚠ SIGNAL DISRUPTION — Re-establishing secure link. Try again.' }]);
    } finally {
      setIsThinking(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!isThinking && input.trim()) processMessage(input);
  };

  // Smart scroll: track if user scrolled up manually
  const chatContainerRef = useRef(null);
  const userScrolledUpRef = useRef(false);

  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    userScrolledUpRef.current = !atBottom;
  };

  // Auto-scroll to bottom unless user scrolled up
  useEffect(() => {
    if (userScrolledUpRef.current) return;
    const el = chatContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history, isThinking]);

  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' // ').slice(0, 22) + ' UTC';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#F6F7F9', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflow: 'hidden' }}>

      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #E5E7EB', background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}>
            BIQc Strategic Console
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#9CA3AF' }}>
          <span>Step {currentStep}/17</span>
          <span style={{ padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: status === 'COMPLETE' ? '#DCFCE7' : '#FEF3C7', color: status === 'COMPLETE' ? '#166534' : '#92400E' }}>
            {status}
          </span>
        </div>
      </header>

      {/* PROGRESS BAR */}
      <div style={{ height: 3, background: '#E5E7EB', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: '#3B82F6', transition: 'width 0.8s ease-out', borderRadius: '0 2px 2px 0' }} />
      </div>

      {/* INTELLIGENCE ACTIONS PANEL */}
      {actions.length > 0 && (
        <div style={{ borderBottom: '1px solid #E5E7EB', flexShrink: 0, background: '#FAFBFC' }}>
          <button
            onClick={() => setActionsOpen(!actionsOpen)}
            style={{ width: '100%', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            data-testid="actions-panel-toggle"
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Intelligence Signals ({actions.filter(a => a.status !== 'ignored').length})
            </span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{actionsOpen ? '▲' : '▼'}</span>
          </button>
          {actionsOpen && (
            <div style={{ padding: '0 20px 12px', maxHeight: 200, overflowY: 'auto' }}>
              {actions.filter(a => a.status !== 'ignored').map(action => (
                <div key={action.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid #F3F4F6' }} data-testid={`action-row-${action.id}`}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: '#1F2937', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {action.content_summary || 'Signal detected'}
                    </p>
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
                      {action.signal_source || 'unknown'} · {action.created_at ? new Date(action.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {['read', 'action_required', 'ignored'].map(s => (
                      <button
                        key={s}
                        onClick={() => toggleAction(action.id, s)}
                        style={{
                          padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                          background: action.status === s ? (s === 'read' ? '#DBEAFE' : s === 'action_required' ? '#FEF3C7' : '#F3F4F6') : '#F9FAFB',
                          color: action.status === s ? (s === 'read' ? '#1D4ED8' : s === 'action_required' ? '#92400E' : '#6B7280') : '#9CA3AF',
                          border: `1px solid ${action.status === s ? (s === 'read' ? '#93C5FD' : s === 'action_required' ? '#FCD34D' : '#D1D5DB') : '#E5E7EB'}`,
                        }}
                        data-testid={`action-${action.id}-${s}`}
                      >
                        {s === 'read' ? 'Read' : s === 'action_required' ? 'Action' : 'Ignore'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CHAT AREA — single scroll container */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16, WebkitOverflowScrolling: 'touch' }}
      >

        {/* Waiting for session */}
        {!sessionReady && !initError && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ color: '#9CA3AF', fontSize: 14 }}>Connecting...</span>
          </div>
        )}

        {/* Session error */}
        {initError && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
            <span style={{ color: '#DC2626', fontSize: 14 }}>{initError}</span>
            <button onClick={() => window.location.reload()} style={{ color: '#3B82F6', fontSize: 14, border: '1px solid #D1D5DB', background: '#fff', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
              Reconnect
            </button>
          </div>
        )}

        {/* Messages */}
        {history.map((msg, i) => (
          <div key={i} style={{ maxWidth: '88%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'user' ? (
              <div style={{
                padding: '12px 16px', fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: '#3B82F6', color: '#fff', borderRadius: '18px 18px 4px 18px',
              }}>
                {msg.content}
              </div>
            ) : (
              <div>
                <div style={{
                  padding: '14px 18px', fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: '#fff', color: '#1F2937', borderRadius: '18px 18px 18px 4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                }}>
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Thinking indicator */}
        {isThinking && (
          <div style={{ maxWidth: '88%', alignSelf: 'flex-start' }}>
            <div style={{
              padding: '14px 18px', background: '#fff', borderRadius: '18px 18px 18px 4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D1D5DB', animation: 'wrDot 1.4s infinite' }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D1D5DB', animation: 'wrDot 1.4s infinite 0.2s' }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D1D5DB', animation: 'wrDot 1.4s infinite 0.4s' }} />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* INPUT — fixed at bottom, keyboard-aware */}
      <form onSubmit={handleSubmit} style={{ padding: '12px 16px', borderTop: '1px solid #E5E7EB', background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #D1D5DB', borderRadius: 12, padding: '10px 14px', background: '#F9FAFB', transition: 'border-color 0.15s' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your response..."
            disabled={isThinking || status === 'COMPLETE' || !sessionReady}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#1F2937', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.5, opacity: (isThinking || !sessionReady) ? 0.5 : 1 }}
          />
          <button
            type="submit"
            disabled={isThinking || !input.trim() || status === 'COMPLETE' || !sessionReady}
            style={{
              padding: '8px 18px', fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
              color: '#fff', background: '#3B82F6', border: 'none', borderRadius: 8,
              cursor: 'pointer', opacity: (isThinking || !input.trim() || !sessionReady) ? 0.3 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            Send
          </button>
        </div>
      </form>

      <style>{`
        @keyframes wrDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

/* ─── Exported wrapper with Error Boundary ─── */
const WarRoomConsole = () => (
  <WarRoomErrorBoundary>
    <WarRoomConsoleInner />
  </WarRoomErrorBoundary>
);

export default WarRoomConsole;
