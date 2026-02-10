import React, { useState, useEffect, useRef, Component } from 'react';
import { supabase } from '../context/SupabaseAuthContext';

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
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Check session availability (non-throwing)
  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) setSessionReady(!!session);
      } catch {
        if (!cancelled) setSessionReady(false);
      }
    };
    checkSession();
    // Also listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setSessionReady(!!session);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  // Auto-init strategy conversation ONLY when session is ready
  useEffect(() => {
    if (!sessionReady) return;
    if (history.length === 0) {
      processMessage(' [SYSTEM_INIT_STRATEGY] ', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isThinking]);

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

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calibration/brain`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          history: history.filter(m => m.role !== 'system'),
        }),
      });

      if (!response.ok) throw new Error('Strategy Connection Failed');
      const data = await response.json();

      if (data.message) setHistory(prev => [...prev, { role: 'assistant', content: data.message }]);
      if (data.percentage_complete) setProgress(data.percentage_complete);
      if (data.current_step_number) setCurrentStep(data.current_step_number);
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

  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' // ').slice(0, 22) + ' UTC';

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#0a0a0a', color: '#f59e0b', fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace", overflow: 'hidden' }}>
      {/* Scanline overlay */}
      <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 10, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)' }} />
      {/* Dot grid */}
      <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 0, backgroundImage: 'radial-gradient(circle, rgba(245,158,11,0.04) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      {/* HEADER */}
      <header style={{ position: 'relative', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(245,158,11,0.15)', background: '#0a0a0a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e, 0 0 12px rgba(34,197,94,0.4)', animation: 'wrPulse 2s ease-in-out infinite', display: 'inline-block' }} />
          <span style={{ fontSize: 13, letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 'bold', color: '#fbbf24' }}>
            BIQc <span style={{ color: 'rgba(245,158,11,0.4)' }}>//</span> Strategic Operations Console
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: 'rgba(245,158,11,0.4)', letterSpacing: '0.1em' }}>
          <span>STEP {currentStep}/17</span>
          <span style={{ padding: '2px 8px', border: `1px solid ${status === 'COMPLETE' ? '#16a34a' : 'rgba(245,158,11,0.3)'}`, fontSize: 10, letterSpacing: '0.2em', color: status === 'COMPLETE' ? '#4ade80' : '#f59e0b' }}>
            {status}
          </span>
        </div>
      </header>

      {/* PROGRESS BAR */}
      <div style={{ position: 'relative', zIndex: 5, height: 3, background: 'rgba(245,158,11,0.08)', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #b45309, #f59e0b)', boxShadow: '0 0 8px rgba(245,158,11,0.3)', transition: 'width 1s ease-out' }} />
      </div>

      {/* LIVE FEED */}
      <div style={{ position: 'relative', zIndex: 5, flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Waiting for session */}
        {!sessionReady && !initError && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ color: 'rgba(245,158,11,0.4)', fontSize: 11, letterSpacing: '0.2em', animation: 'wrBlink 1.5s ease-in-out infinite' }}>
              ESTABLISHING SECURE LINK...
            </span>
          </div>
        )}

        {/* Session error */}
        {initError && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
            <span style={{ color: '#ef4444', fontSize: 11, letterSpacing: '0.15em' }}>⚠ {initError}</span>
            <button onClick={() => window.location.reload()} style={{ color: '#f59e0b', fontSize: 11, letterSpacing: '0.15em', border: '1px solid rgba(245,158,11,0.3)', background: 'transparent', padding: '4px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
              RECONNECT
            </button>
          </div>
        )}

        {/* Messages */}
        {history.map((msg, i) => (
          <div key={i} style={{ maxWidth: '85%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', marginBottom: 4, color: msg.role === 'user' ? 'rgba(34,197,94,0.5)' : 'rgba(245,158,11,0.4)', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
              {msg.role === 'user' ? '[ OPERATOR ]' : '[ WATCHTOWER ]'}
            </div>
            <div style={{
              padding: '12px 16px', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              border: `1px solid ${msg.role === 'user' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.12)'}`,
              background: msg.role === 'user' ? 'rgba(34,197,94,0.04)' : 'rgba(245,158,11,0.03)',
              color: msg.role === 'user' ? '#d1d5db' : '#fbbf24',
              borderLeft: msg.role === 'user' ? 'none' : '2px solid rgba(245,158,11,0.3)',
              borderRight: msg.role === 'user' ? '2px solid rgba(34,197,94,0.3)' : 'none',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {isThinking && (
          <div style={{ maxWidth: '85%', alignSelf: 'flex-start' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', marginBottom: 4, color: 'rgba(245,158,11,0.4)' }}>[ WATCHTOWER ]</div>
            <div style={{ padding: '12px 16px', border: '1px solid rgba(245,158,11,0.12)', background: 'rgba(245,158,11,0.03)', borderLeft: '2px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'wrDot 1.4s infinite' }} />
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'wrDot 1.4s infinite 0.2s' }} />
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'wrDot 1.4s infinite 0.4s' }} />
              <span style={{ marginLeft: 12, color: 'rgba(245,158,11,0.3)', fontSize: 10, letterSpacing: '0.2em' }}>CALCULATING STRATEGY</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* INPUT DECK */}
      <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 5, padding: '16px 20px', borderTop: '1px solid rgba(245,158,11,0.15)', background: '#0a0a0a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(245,158,11,0.2)', padding: '8px 12px', background: 'rgba(0,0,0,0.6)' }}>
          <span style={{ color: '#d97706', fontSize: 14, userSelect: 'none' }}>▸</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ENTER TACTICAL DATA..."
            disabled={isThinking || status === 'COMPLETE' || !sessionReady}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e5e7eb', fontFamily: 'inherit', fontSize: 13, letterSpacing: '0.05em', opacity: (isThinking || !sessionReady) ? 0.4 : 1 }}
            autoFocus
          />
          <button
            type="submit"
            disabled={isThinking || !input.trim() || status === 'COMPLETE' || !sessionReady}
            style={{ padding: '6px 18px', fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.2em', fontWeight: 600, color: '#0a0a0a', background: '#f59e0b', border: 'none', cursor: 'pointer', opacity: (isThinking || !input.trim() || !sessionReady) ? 0.3 : 1 }}
          >
            TRANSMIT
          </button>
        </div>
      </form>

      {/* Keyframe animations */}
      <style>{`
        @keyframes wrPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #22c55e, 0 0 12px rgba(34,197,94,0.4); }
          50% { opacity: 0.5; box-shadow: 0 0 3px #22c55e; }
        }
        @keyframes wrDot {
          0%, 80%, 100% { opacity: 0.15; }
          40% { opacity: 1; }
        }
        @keyframes wrBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
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
