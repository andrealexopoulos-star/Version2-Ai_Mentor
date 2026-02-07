import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../context/SupabaseAuthContext';

const WarRoomConsole = () => {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [status, setStatus] = useState('ACTIVE');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [booted, setBooted] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // CRT boot sequence
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 600);
    return () => clearTimeout(t);
  }, []);

  // Auto-init strategy conversation
  useEffect(() => {
    if (!booted) return;
    if (history.length === 0) {
      processMessage(' [SYSTEM_INIT_STRATEGY] ', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isThinking]);

  const processMessage = async (text, isHidden = false) => {
    if (!text.trim()) return;
    if (!isHidden) setHistory(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsThinking(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session invalid.');

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
      setHistory(prev => [...prev, { role: 'assistant', content: '⚠ SIGNAL DISRUPTION — Re-establishing secure link...' }]);
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
    <div className={`war-room-shell ${booted ? 'war-room-booted' : ''}`}>
      {/* CRT Scanline overlay */}
      <div className="war-room-scanlines" />
      {/* Dot grid background */}
      <div className="war-room-grid" />

      {/* ─── HEADER ─── */}
      <header className="war-room-header">
        <div className="flex items-center gap-3">
          <span className="war-room-pulse" />
          <span className="text-xs sm:text-sm tracking-[0.25em] uppercase font-bold text-amber-400">
            Strategic Operations <span className="text-amber-700">//</span> Active
          </span>
        </div>
        <div className="flex items-center gap-4 text-[10px] sm:text-xs text-amber-700 tracking-wider">
          <span>STEP {currentStep}/17</span>
          <span className="hidden sm:inline">{timestamp}</span>
          <span className={`px-2 py-0.5 border text-[10px] tracking-widest ${status === 'COMPLETE' ? 'border-green-600 text-green-400' : 'border-amber-800 text-amber-500'}`}>
            {status}
          </span>
        </div>
      </header>

      {/* ─── PROGRESS BAR ─── */}
      <div className="war-room-progress-track">
        <div className="war-room-progress-fill" style={{ width: `${progress}%` }} />
        <span className="war-room-progress-label">{progress}%</span>
      </div>

      {/* ─── LIVE FEED ─── */}
      <div className="war-room-feed">
        {history.length === 0 && !isThinking && (
          <div className="flex items-center justify-center h-full">
            <span className="text-amber-900/60 text-xs tracking-widest animate-pulse">
              INITIALIZING STRATEGIC LINK...
            </span>
          </div>
        )}

        {history.map((msg, i) => (
          <div key={i} className={`war-room-msg ${msg.role === 'user' ? 'war-room-msg-user' : 'war-room-msg-ai'}`}>
            <div className="war-room-msg-tag">
              {msg.role === 'user' ? '[ OPERATOR ]' : '[ WATCHTOWER ]'}
            </div>
            <div className="war-room-msg-body">
              {msg.content}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="war-room-msg war-room-msg-ai">
            <div className="war-room-msg-tag">[ WATCHTOWER ]</div>
            <div className="war-room-thinking">
              <span /><span /><span />
              <span className="ml-3 text-amber-800 text-[10px] tracking-widest">CALCULATING STRATEGY</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* ─── INPUT DECK ─── */}
      <form onSubmit={handleSubmit} className="war-room-input-deck">
        <div className="war-room-input-row">
          <span className="text-amber-600 text-sm select-none">▸</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ENTER TACTICAL DATA..."
            disabled={isThinking || status === 'COMPLETE'}
            className="war-room-input"
            autoFocus
          />
          <button
            type="submit"
            disabled={isThinking || !input.trim() || status === 'COMPLETE'}
            className="war-room-transmit"
          >
            TRANSMIT
          </button>
        </div>
      </form>

      <style>{`
        /* ── Shell & CRT boot ── */
        .war-room-shell {
          position: relative;
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          background: #0a0a0a;
          color: #f59e0b;
          font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
          overflow: hidden;
          opacity: 0;
          transform: scale(0.97);
          transition: opacity 0.8s ease, transform 0.8s ease;
        }
        .war-room-booted {
          opacity: 1;
          transform: scale(1);
        }

        /* ── Scanline overlay ── */
        .war-room-scanlines {
          pointer-events: none;
          position: absolute;
          inset: 0;
          z-index: 10;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.08) 2px,
            rgba(0,0,0,0.08) 4px
          );
        }

        /* ── Dot grid ── */
        .war-room-grid {
          pointer-events: none;
          position: absolute;
          inset: 0;
          z-index: 0;
          background-image: radial-gradient(circle, rgba(245,158,11,0.04) 1px, transparent 1px);
          background-size: 24px 24px;
        }

        /* ── Header ── */
        .war-room-header {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          border-bottom: 1px solid rgba(245,158,11,0.15);
          background: linear-gradient(180deg, rgba(10,10,10,1) 0%, rgba(10,10,10,0.95) 100%);
          flex-shrink: 0;
        }

        /* ── Pulsing green dot ── */
        .war-room-pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 6px #22c55e, 0 0 12px rgba(34,197,94,0.4);
          animation: pulse-glow 2s ease-in-out infinite;
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #22c55e, 0 0 12px rgba(34,197,94,0.4); }
          50% { opacity: 0.5; box-shadow: 0 0 3px #22c55e, 0 0 6px rgba(34,197,94,0.2); }
        }

        /* ── Progress ── */
        .war-room-progress-track {
          position: relative;
          z-index: 5;
          height: 3px;
          background: rgba(245,158,11,0.08);
          flex-shrink: 0;
        }
        .war-room-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #b45309, #f59e0b);
          box-shadow: 0 0 8px rgba(245,158,11,0.3);
          transition: width 1s ease-out;
        }
        .war-room-progress-label {
          position: absolute;
          right: 8px;
          top: 4px;
          font-size: 9px;
          color: rgba(245,158,11,0.4);
          letter-spacing: 0.1em;
        }

        /* ── Feed ── */
        .war-room-feed {
          position: relative;
          z-index: 5;
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          scrollbar-width: thin;
          scrollbar-color: rgba(245,158,11,0.15) transparent;
        }
        .war-room-feed::-webkit-scrollbar { width: 4px; }
        .war-room-feed::-webkit-scrollbar-track { background: transparent; }
        .war-room-feed::-webkit-scrollbar-thumb { background: rgba(245,158,11,0.15); border-radius: 2px; }

        /* ── Messages ── */
        .war-room-msg {
          max-width: 85%;
          animation: msg-in 0.3s ease-out;
        }
        @keyframes msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .war-room-msg-ai { align-self: flex-start; }
        .war-room-msg-user { align-self: flex-end; }

        .war-room-msg-tag {
          font-size: 9px;
          letter-spacing: 0.2em;
          margin-bottom: 4px;
        }
        .war-room-msg-ai .war-room-msg-tag { color: rgba(245,158,11,0.4); }
        .war-room-msg-user .war-room-msg-tag { color: rgba(34,197,94,0.5); text-align: right; }

        .war-room-msg-body {
          padding: 12px 16px;
          font-size: 13px;
          line-height: 1.7;
          border: 1px solid;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .war-room-msg-ai .war-room-msg-body {
          border-color: rgba(245,158,11,0.12);
          background: rgba(245,158,11,0.03);
          color: #fbbf24;
          border-left: 2px solid rgba(245,158,11,0.3);
        }
        .war-room-msg-user .war-room-msg-body {
          border-color: rgba(34,197,94,0.15);
          background: rgba(34,197,94,0.04);
          color: #d1d5db;
          border-right: 2px solid rgba(34,197,94,0.3);
        }

        /* ── Thinking dots ── */
        .war-room-thinking {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border: 1px solid rgba(245,158,11,0.12);
          background: rgba(245,158,11,0.03);
          border-left: 2px solid rgba(245,158,11,0.3);
        }
        .war-room-thinking span:nth-child(-n+3) {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #f59e0b;
          margin-right: 4px;
          animation: dot-blink 1.4s infinite;
        }
        .war-room-thinking span:nth-child(2) { animation-delay: 0.2s; }
        .war-room-thinking span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dot-blink {
          0%, 80%, 100% { opacity: 0.15; }
          40% { opacity: 1; }
        }

        /* ── Input deck ── */
        .war-room-input-deck {
          position: relative;
          z-index: 5;
          padding: 16px 20px;
          border-top: 1px solid rgba(245,158,11,0.15);
          background: linear-gradient(0deg, rgba(10,10,10,1) 0%, rgba(10,10,10,0.95) 100%);
          flex-shrink: 0;
        }
        .war-room-input-row {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(245,158,11,0.2);
          padding: 8px 12px;
          background: rgba(0,0,0,0.6);
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .war-room-input-row:focus-within {
          border-color: rgba(245,158,11,0.5);
          box-shadow: 0 0 15px rgba(245,158,11,0.08), inset 0 0 15px rgba(245,158,11,0.03);
        }
        .war-room-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #e5e7eb;
          font-family: inherit;
          font-size: 13px;
          letter-spacing: 0.05em;
        }
        .war-room-input::placeholder {
          color: rgba(245,158,11,0.2);
          letter-spacing: 0.1em;
        }
        .war-room-input:disabled {
          opacity: 0.4;
        }
        .war-room-transmit {
          padding: 6px 18px;
          font-family: inherit;
          font-size: 11px;
          letter-spacing: 0.2em;
          font-weight: 600;
          color: #0a0a0a;
          background: #f59e0b;
          border: none;
          cursor: pointer;
          transition: background 0.2s, box-shadow 0.2s;
        }
        .war-room-transmit:hover:not(:disabled) {
          background: #fbbf24;
          box-shadow: 0 0 12px rgba(245,158,11,0.4);
        }
        .war-room-transmit:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default WarRoomConsole;
