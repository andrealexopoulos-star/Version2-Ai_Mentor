/**
 * AgentCalibrationChat
 *
 * 9-step operator psychology profiling that builds the personalised BIQc
 * Intelligence Agent for this user. Uses the calibration-psych Supabase
 * edge function (OpenAI structured outputs).
 *
 * Placed in the calibration flow AFTER the CMO Report and BEFORE
 * "Here's What BIQc Found" (ExecutiveCMOSnapshot).
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowRight, Loader2, Brain, ChevronRight } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

const STEPS_LABELS = [
  'Communication style',
  'Level of detail',
  'Directness preference',
  'Risk posture',
  'Decision approach',
  'Accountability cadence',
  'Time constraints',
  'Challenge tolerance',
  'Boundaries & tone',
];

// ── Intro screen before chat starts ──────────────────────────────────────────
const IntroScreen = ({ firstName, onStart }) => (
  <div className="h-screen flex flex-col items-center justify-center px-6 text-center"
    style={{ background: '#070E18' }}>
    <style>{`@keyframes agentPulse{0%,100%{transform:scale(1);opacity:0.7}50%{transform:scale(1.08);opacity:1}}`}</style>

    {/* Animated agent icon */}
    <div className="relative w-20 h-20 mx-auto mb-7">
      <div className="absolute inset-0 rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #FF7A18 0%, #7C3AED 100%)', animation: 'agentPulse 3s ease-in-out infinite', borderRadius: 18 }} />
      <div className="absolute inset-0.5 rounded-2xl flex items-center justify-center"
        style={{ background: '#0A1018', borderRadius: 17 }}>
        <Brain className="w-9 h-9" style={{ color: '#FF7A18' }} />
      </div>
    </div>

    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5"
      style={{ background: 'rgba(255,122,24,0.08)', border: '1px solid rgba(255,122,24,0.2)' }}>
      <span className="text-[10px] font-semibold tracking-widest uppercase"
        style={{ color: '#FF7A18', fontFamily: fontFamily.mono }}>Agent Personalisation</span>
    </div>

    <h1 className="text-2xl sm:text-3xl font-semibold mb-4 max-w-md"
      style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>
      Now we build your personalised<br />BIQc Intelligence Agent
      {firstName ? `, ${firstName}` : ''}.
    </h1>

    <p className="text-sm leading-relaxed max-w-sm mb-6"
      style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
      We're going to ask you{' '}
      <span style={{ color: '#FF7A18', fontWeight: 600 }}>9 questions</span>{' '}
      about how you think, communicate and make decisions. Your answers will be used
      to calibrate a world-class AI advisor that speaks your language, respects your
      boundaries and delivers intelligence exactly the way you need it.
    </p>

    <div className="grid grid-cols-3 gap-3 max-w-sm w-full mb-7">
      {['Communication style', 'Risk posture', 'Decision approach'].map((label, i) => (
        <div key={i} className="rounded-xl p-3 text-center"
          style={{ background: 'rgba(255,122,24,0.06)', border: '1px solid rgba(255,122,24,0.15)' }}>
          <p className="text-[10px] leading-snug" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>{label}</p>
        </div>
      ))}
    </div>

    <p className="text-xs mb-6" style={{ color: '#64748B', fontFamily: fontFamily.body }}>
      Takes about 3 minutes · Your answers are private · Used only to personalise your agent
    </p>

    <button onClick={onStart}
      className="px-10 py-3.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:brightness-110"
      style={{ background: 'linear-gradient(135deg, #FF7A18, #E56A08)', color: 'white', fontFamily: fontFamily.body, boxShadow: '0 8px 28px rgba(255,106,0,0.28)' }}
      data-testid="agent-calibration-start">
      Begin Agent Calibration <ArrowRight className="w-4 h-4" />
    </button>
  </div>
);

// ── Main chat interface ───────────────────────────────────────────────────────

const AgentCalibrationChat = ({ callEdge, firstName, onComplete }) => {
  const [phase, setPhase] = useState('intro'); // intro | chat | done
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startChat = async () => {
    setPhase('chat');
    setSending(true);
    try {
      const data = await callEdge({ message: 'init', step: 0, history: [] });
      setMessages([{ role: 'agent', text: data.message }]);
      setStep(data.step || 1);
      setPct(data.percentage || 0);
    } catch {
      setMessages([{ role: 'agent', text: "Let's start with how you prefer to receive information. Do you prefer bullet points, narrative paragraphs, data-first summaries, or conversational responses?" }]);
      setStep(1);
    }
    setSending(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setSending(true);

    try {
      const history = messages.map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.text }));
      const data = await callEdge({ message: userMsg, step, history });

      setMessages(prev => [...prev, { role: 'agent', text: data.message }]);
      setStep(data.step || step);
      setPct(data.percentage || pct);

      if (data.status === 'COMPLETE') {
        setTimeout(() => setPhase('done'), 1500);
        setTimeout(() => onComplete(), 3000);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'agent', text: "I didn't catch that — could you rephrase your answer?" }]);
    }
    setSending(false);
  };

  if (phase === 'intro') return <IntroScreen firstName={firstName} onStart={startChat} />;

  if (phase === 'done') {
    return (
      <div className="h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: '#070E18' }}>
        <div className="w-16 h-16 rounded-full mb-6 flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.4)' }}>
          <Brain className="w-8 h-8" style={{ color: '#10B981' }} />
        </div>
        <h2 className="text-2xl font-semibold mb-3" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>
          Agent calibrated.
        </h2>
        <p className="text-sm max-w-xs" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
          Your BIQc Intelligence Agent has been personalised. Building your intelligence snapshot…
        </p>
        <div className="mt-6 flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#10B981', opacity: 0.4 + i * 0.3, animation: `pulse ${1 + i * 0.3}s infinite` }} />
          ))}
        </div>
      </div>
    );
  }

  // Chat phase
  const currentStepLabel = STEPS_LABELS[step - 1] || 'Building agent…';

  return (
    <div className="h-screen flex flex-col" style={{ background: '#070E18' }}>

      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #1E2D3D' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,122,24,0.1)', border: '1px solid rgba(255,122,24,0.2)' }}>
              <Brain className="w-4 h-4" style={{ color: '#FF7A18' }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#F4F7FA', fontFamily: fontFamily.body }}>
                BIQc Agent Calibration
              </p>
              <p className="text-[10px]" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
                Step {Math.min(step, 9)} of 9 — {currentStepLabel}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold" style={{ color: '#FF7A18', fontFamily: fontFamily.mono }}>
            {pct}%
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1 rounded-full" style={{ background: '#1E2D3D' }}>
          <div className="h-1 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #FF7A18, #E56A08)' }} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'agent' && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-2.5 mt-0.5"
                style={{ background: 'rgba(255,122,24,0.15)' }}>
                <Brain className="w-3.5 h-3.5" style={{ color: '#FF7A18' }} />
              </div>
            )}
            <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed`}
              style={{
                background: msg.role === 'user' ? 'rgba(255,122,24,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(255,122,24,0.2)' : 'rgba(255,255,255,0.06)'}`,
                color: '#F4F7FA',
                fontFamily: fontFamily.body,
                borderTopRightRadius: msg.role === 'user' ? 4 : 16,
                borderTopLeftRadius: msg.role === 'agent' ? 4 : 16,
              }}>
              {msg.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-2.5"
              style={{ background: 'rgba(255,122,24,0.15)' }}>
              <Brain className="w-3.5 h-3.5" style={{ color: '#FF7A18' }} />
            </div>
            <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#FF7A18', opacity: 0.5, animation: `bounce ${0.8 + i * 0.15}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-5 pt-3" style={{ borderTop: '1px solid #1E2D3D' }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Type your answer…"
            rows={1}
            className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: '#141C26',
              border: '1px solid #243140',
              color: '#F4F7FA',
              fontFamily: fontFamily.body,
              maxHeight: 100,
            }}
            disabled={sending}
            data-testid="agent-calibration-input"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              background: input.trim() && !sending ? 'linear-gradient(135deg, #FF7A18, #E56A08)' : '#1E2D3D',
              color: input.trim() && !sending ? 'white' : '#4A5568',
            }}
            data-testid="agent-calibration-send">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-center text-[10px] mt-2" style={{ color: '#4A5568', fontFamily: fontFamily.mono }}>
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default AgentCalibrationChat;
