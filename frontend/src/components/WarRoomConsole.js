import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../context/SupabaseAuthContext';
import { useSnapshot } from '../hooks/useSnapshot';
import { Send, RefreshCw } from 'lucide-react';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const HEAD = "var(--font-heading)";
const MONO = "var(--font-mono)";

const STATE_CFG = {
  STABLE:      { label: 'Stable', color: '#166534', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
  DRIFT:       { label: 'Drift', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
  COMPRESSION: { label: 'Compression', color: '#9A3412', bg: '#FFF7ED', border: '#FED7AA', dot: '#F97316' },
  CRITICAL:    { label: 'Critical', color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444' },
};

const WarRoomConsole = () => {
  const { cognitive, sources, owner, timeOfDay, loading, error, cacheAge, refreshing, refresh } = useSnapshot();
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [conversation, setConversation] = useState([]);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const askQuestion = async () => {
    if (!question.trim() || asking) return;
    var q = question.trim();
    setQuestion('');
    setConversation(function(prev) { return prev.concat([{ role: 'user', text: q }]); });
    setAsking(true);
    try {
      var sess = await supabase.auth.getSession();
      var token = sess.data.session.access_token;
      var res = await fetch(SUPABASE_URL + '/functions/v1/strategic-console-ai', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: JSON.stringify({ mode: 'ask', question: q }),
      });
      var data = await res.json();
      setConversation(function(prev) { return prev.concat([{ role: 'advisor', text: data.answer || data.error || 'Unable to process.', sources: data.data_sources }]); });
    } catch (e) {
      setConversation(function(prev) { return prev.concat([{ role: 'advisor', text: 'Connection issue. Please try again.' }]); });
    } finally { setAsking(false); setTimeout(function() { if (inputRef.current) inputRef.current.focus(); }, 100); }
  };

  useEffect(function() { if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' }); }, [conversation, asking]);

  var c = cognitive || {};
  var st = STATE_CFG[c.system_state] || STATE_CFG.STABLE;

  return (
    <div className="flex flex-col h-full min-h-screen" style={{ background: 'linear-gradient(180deg, #F8F9FA 0%, #EFF1F3 40%, #E8EAED 100%)', fontFamily: HEAD }}>
      <header className="flex items-center justify-between px-6 md:px-10 py-3.5 shrink-0" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-5">
          <a href="/advisor" className="text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-black/5" style={{ color: '#6B7280', textDecoration: 'none' }} data-testid="console-home-btn">← Dashboard</a>
          <div className="h-4 w-px" style={{ background: '#E5E7EB' }} />
          <span className="text-sm font-semibold" style={{ color: '#111827' }}>Strategic Console</span>
          {!loading && cognitive && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full" style={{ background: st.bg, border: '1px solid ' + st.border }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
              <span className="text-[10px] font-semibold tracking-wide" style={{ color: st.color, fontFamily: MONO }}>{st.label}</span>
            </div>
          )}
        </div>
        <button onClick={refresh} disabled={refreshing || loading} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-black/5" style={{ color: '#9CA3AF' }} data-testid="refresh-btn">
          <RefreshCw className="w-3.5 h-3.5" />
          {cacheAge !== null && cacheAge > 0 ? cacheAge + 'm ago' : 'Refresh'}
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-8 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <span className="text-xs text-[#FF6A00]" style={{ fontFamily: "monospace" }}>loading...</span>
              <p className="text-sm font-medium" style={{ color: '#374151' }}>Loading strategic brief...</p>
            </div>
          )}
          {error && !loading && (
            <div className="p-6 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-sm" style={{ color: '#D97706' }}>{error}</p>
            </div>
          )}
          {cognitive && !loading && (
            <>
              <h1 className="text-2xl font-semibold" style={{ color: '#111827' }}>Good {timeOfDay}, {owner}.</h1>
              {c.system_state_interpretation && <p className="text-sm" style={{ color: '#6B7280' }}>{c.system_state_interpretation}</p>}
              {c.executive_memo && (
                <div className="p-7 rounded-2xl" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <span className="text-[10px] font-semibold tracking-widest uppercase block mb-3" style={{ color: '#111827', fontFamily: MONO }}>Executive Brief</span>
                  <p className="text-[15px] leading-relaxed whitespace-pre-line" style={{ color: '#1F2937' }}>{c.executive_memo}</p>
                </div>
              )}
              {c.market_position && (
                <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.04)' }}>
                  <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#6B7280', fontFamily: MONO }}>Market Context</span>
                  <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{c.market_position}</p>
                </div>
              )}
              {sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-medium" style={{ color: '#9CA3AF', fontFamily: MONO }}>Sources:</span>
                  {sources.map(function(s, i) { return <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#6B7280', background: 'rgba(0,0,0,0.04)', fontFamily: MONO }}>{s}</span>; })}
                </div>
              )}
            </>
          )}
          {conversation.length > 0 && (
            <div className="space-y-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              {conversation.map(function(msg, i) { return (
                <div key={i} className={'flex ' + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className="max-w-[85%] p-4 rounded-2xl" style={msg.role === 'user' ? { background: '#111827', color: '#F9FAFB' } : { background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.06)', color: '#1F2937' }}>
                    <p className="text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>
                  </div>
                </div>
              ); })}
              {asking && (<div className="flex justify-start"><div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.06)' }}><div className="flex items-center gap-2"><div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" /><div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} /><div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} /></div></div></div>)}
              <div ref={scrollRef} />
            </div>
          )}
        </div>
      </div>
      {!loading && cognitive && (
        <div className="shrink-0 px-6 md:px-10 py-4" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <form onSubmit={function(e) { e.preventDefault(); askQuestion(); }} className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#FFF', border: '1px solid rgba(0,0,0,0.08)' }}>
              <input ref={inputRef} type="text" value={question} onChange={function(e) { setQuestion(e.target.value); }} placeholder="Ask about your business..." disabled={asking} className="flex-1 text-sm outline-none bg-transparent" style={{ color: '#1F2937', fontFamily: HEAD }} data-testid="ask-input" />
              <button type="submit" disabled={asking || !question.trim()} className="p-2 rounded-lg" style={{ color: question.trim() ? '#111827' : '#D1D5DB' }} data-testid="ask-submit"><Send className="w-4 h-4" /></button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default WarRoomConsole;
