import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Lightbulb } from 'lucide-react';
import { apiClient } from '../lib/api';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

/**
 * FloatingSoundboard — A floating brainstorm/question widget for Intelligence pages.
 * Appears as a button in the bottom-right, expands to a panel.
 */
const FloatingSoundboard = ({ context = '' }) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await apiClient.post('/soundboard/message', {
        message: userMsg,
        context: context,
        history: messages.slice(-6).map(m => ({ role: m.role, content: m.text })),
      });
      const reply = res.data?.response || res.data?.message || 'Let me think about that...';
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'I\'m having trouble connecting. Try again in a moment.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #FF6A00, #E85D00)', boxShadow: '0 8px 32px rgba(255,106,0,0.4)' }}
        data-testid="soundboard-fab"
      >
        <Lightbulb className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#0A1018', border: '1px solid #243140' }} data-testid="soundboard-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #243140' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#FF6A0020' }}>
            <Lightbulb className="w-4 h-4 text-[#FF6A00]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>SoundBoard</h3>
            <p className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>Brainstorm on your data</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-[#64748B]" data-testid="soundboard-close">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="h-[320px] overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Lightbulb className="w-8 h-8 mx-auto mb-3 text-[#FF6A00]/30" />
            <p className="text-sm text-[#64748B]" style={{ fontFamily: INTER }}>Ask a question about your data or brainstorm ideas.</p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {['What should I focus on?', 'Summarise my risks', 'How can I grow revenue?'].map(q => (
                <button key={q} onClick={() => { setInput(q); }} className="text-[11px] px-3 py-1.5 rounded-lg" style={{ background: '#141C26', color: '#9FB0C3', border: '1px solid #243140', fontFamily: MONO }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${msg.role === 'user' ? '' : ''}`}
              style={{
                background: msg.role === 'user' ? '#FF6A00' : '#141C26',
                color: msg.role === 'user' ? 'white' : '#9FB0C3',
                border: msg.role === 'user' ? 'none' : '1px solid #243140',
                fontFamily: INTER,
              }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 rounded-xl text-sm" style={{ background: '#141C26', border: '1px solid #243140', color: '#FF6A00', fontFamily: MONO }}>
              thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2" style={{ borderTop: '1px solid #243140' }}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask anything about your business..."
            className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#141C26', border: '1px solid #243140', color: '#F4F7FA', fontFamily: INTER }}
            data-testid="soundboard-input"
          />
          <button onClick={sendMessage} disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-30"
            style={{ background: '#FF6A00' }}
            data-testid="soundboard-send">
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingSoundboard;
