import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../context/SupabaseAuthContext';
import { Send, RefreshCw } from 'lucide-react';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const HEAD = "'Inter Tight', 'Inter', -apple-system, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', monospace";

const STATE_CONFIG = {
  STABLE:      { label: 'Stable',      color: '#166534', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
  DRIFT:       { label: 'Drift',       color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
  COMPRESSION: { label: 'Compression', color: '#9A3412', bg: '#FFF7ED', border: '#FED7AA', dot: '#F97316' },
  CRITICAL:    { label: 'Critical',    color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444' },
};

const WarRoomConsole = () => {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sources, setSources] = useState([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const callEdge = async (payload) => {
    const token = await getToken();
    if (!token) throw new Error('No session');
    const res = await fetch(`${SUPABASE_URL}/functions/v1/strategic-console-ai`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  };

  const loadBrief = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callEdge({ mode: 'brief' });
      setBriefing(data.briefing);
      setSources(data.data_sources || []);
    } catch (e) {
      setError(`Brief unavailable. ${e.message === '404' ? 'Deploy the strategic-console-ai Edge Function.' : 'Please try again.'}`);
    } finally { setLoading(false); }
  };

  const refreshBrief = async () => {
    setRefreshing(true);
    await loadBrief();
    setRefreshing(false);
  };

  const askQuestion = async () => {
    if (!question.trim() || asking) return;
    const q = question.trim();
    setQuestion('');
    setConversation(prev => [...prev, { role: 'user', text: q }]);
    setAsking(true);
    try {
      const data = await callEdge({ mode: 'ask', question: q });
      setConversation(prev => [...prev, { role: 'advisor', text: data.answer, sources: data.data_sources }]);
    } catch {
      setConversation(prev => [...prev, { role: 'advisor', text: "I wasn't able to process that right now. Please try again." }]);
    } finally {
      setAsking(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  useEffect(() => { loadBrief(); }, []);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversation, asking]);

  const b = briefing || {};
  const st = STATE_CONFIG[b.state] || STATE_CONFIG.STABLE;

  return (
    <div className="flex flex-col h-full min-h-screen" style={{ background: 'linear-gradient(180deg, #F8F9FA 0%, #EFF1F3 40%, #E8EAED 100%)', fontFamily: HEAD }}>

      {/* Header */}
      <header className="flex items-center justify-between px-6 md:px-10 py-3.5 shrink-0" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-5">
          <a href="/advisor" className="text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-black/5" style={{ color: '#6B7280', textDecoration: 'none' }} data-testid="console-home-btn">← Dashboard</a>
          <div className="h-4 w-px" style={{ background: '#E5E7EB' }} />
          <span className="text-sm font-semibold" style={{ color: '#111827' }}>Strategic Console</span>
          {!loading && briefing && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full" style={{ background: st.bg, border: `1px solid ${st.border}` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
              <span className="text-[10px] font-semibold tracking-wide" style={{ color: st.color, fontFamily: MONO }}>{st.label}</span>
            </div>
          )}
        </div>
        <button onClick={refreshBrief} disabled={refreshing || loading} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-black/5" style={{ color: '#9CA3AF' }} data-testid="refresh-btn">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Brief'}
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-8 space-y-6">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mb-5" />
              <p className="text-sm font-medium" style={{ color: '#374151' }}>Preparing your executive brief...</p>
              <p className="text-[11px] mt-1" style={{ color: '#9CA3AF' }}>Reading emails, CRM, financials, and market signals</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="p-6 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-sm" style={{ color: '#D97706' }}>{error}</p>
              <button onClick={loadBrief} className="text-xs font-medium mt-4 px-4 py-1.5 rounded-lg" style={{ color: '#6B7280', border: '1px solid #E5E7EB' }}>Retry</button>
            </div>
          )}

          {/* Briefing */}
          {briefing && !loading && (
            <>
              {/* Greeting + State */}
              <div>
                <h1 className="text-2xl font-semibold mb-1" style={{ color: '#111827' }}>{b.greeting || 'Your Executive Brief'}</h1>
                {b.state_reason && <p className="text-sm" style={{ color: '#6B7280' }}>{b.state_reason}</p>}
              </div>

              {/* What Matters */}
              {b.what_matters && (
                <div className="p-7 rounded-2xl" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <span className="text-[10px] font-semibold tracking-widest uppercase block mb-3" style={{ color: '#111827', fontFamily: MONO }}>What Matters Now</span>
                  <p className="text-[15px] leading-relaxed whitespace-pre-line" style={{ color: '#1F2937' }}>{b.what_matters}</p>
                </div>
              )}

              {/* Decision Required */}
              {b.decision_required && (
                <div className="p-6 rounded-2xl" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#991B1B', fontFamily: MONO }}>Decision Required</span>
                  <p className="text-sm leading-relaxed" style={{ color: '#7F1D1D' }}>{b.decision_required}</p>
                </div>
              )}

              {/* What Is Forming */}
              {b.what_is_forming && (
                <div className="p-6 rounded-2xl" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#92400E', fontFamily: MONO }}>What Is Forming</span>
                  <p className="text-sm leading-relaxed" style={{ color: '#78350F' }}>{b.what_is_forming}</p>
                </div>
              )}

              {/* Market Context */}
              {b.market_context && (
                <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#6B7280', fontFamily: MONO }}>Market Context</span>
                  <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{b.market_context}</p>
                </div>
              )}

              {/* What Can Wait */}
              {b.what_can_wait && (
                <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.04)' }}>
                  <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#9CA3AF', fontFamily: MONO }}>What Can Wait</span>
                  <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>{b.what_can_wait}</p>
                </div>
              )}

              {/* Closing */}
              {b.closing && (
                <p className="text-sm text-center py-2" style={{ color: '#9CA3AF', fontStyle: 'italic' }}>{b.closing}</p>
              )}

              {/* Sources */}
              {sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="text-[10px] font-medium" style={{ color: '#9CA3AF', fontFamily: MONO }}>Sources:</span>
                  {sources.map((s, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#6B7280', background: 'rgba(0,0,0,0.04)', fontFamily: MONO }}>{s}</span>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Conversation */}
          {conversation.length > 0 && (
            <div className="space-y-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              {conversation.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] p-4 rounded-2xl" style={msg.role === 'user'
                    ? { background: '#111827', color: '#F9FAFB' }
                    : { background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.06)', color: '#1F2937' }
                  }>
                    <p className="text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>
                    {msg.sources && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {msg.sources.map((s, j) => (
                          <span key={j} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.06)', color: '#9CA3AF', fontFamily: MONO }}>{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {asking && (
                <div className="flex justify-start">
                  <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </div>
      </div>

      {/* Ask Input */}
      {!loading && briefing && (
        <div className="shrink-0 px-6 md:px-10 py-4" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <form onSubmit={(e) => { e.preventDefault(); askQuestion(); }} className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#FFF', border: '1px solid rgba(0,0,0,0.08)' }}>
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about your business... e.g. 'When was the last email to ric@harvestclinic.com.au?'"
                disabled={asking}
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: '#1F2937', fontFamily: HEAD }}
                data-testid="ask-input"
              />
              <button type="submit" disabled={asking || !question.trim()} className="p-2 rounded-lg transition-colors" style={{ color: question.trim() ? '#111827' : '#D1D5DB' }} data-testid="ask-submit">
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-center mt-2" style={{ color: '#9CA3AF' }}>Ask about emails, deals, invoices, contacts, or anything in your connected systems</p>
          </form>
        </div>
      )}
    </div>
  );
};

export default WarRoomConsole;
