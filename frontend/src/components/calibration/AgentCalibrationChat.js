/**
 * AgentCalibrationChat
 *
 * 6-step operator psychology profiling with dynamic multiple choice options.
 * Uses calibration-psych Supabase edge function.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowRight, Loader2, Brain } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

const TOTAL_STEPS = 6;

const STEPS_LABELS = [
  'Communication & thinking',
  'Risk & decisions',
  'Strategic depth',
  'Challenge tolerance',
  'Accountability style',
  'Boundaries & tone',
];

const FALLBACK_QUESTIONS = [
  "Let's start with how you communicate and think. Do you prefer bullet points, narrative depth, data-first summaries, or a conversational back-and-forth?",
  'When risk shows up, how do you want to handle it — conservative protection, calculated moves, or aggressive growth plays?',
  'How deep do you want strategic analysis to go — surface-level actions, moderate context, or full-depth exploration?',
  'How hard should BIQc push back on your thinking — challenge everything, challenge when warranted, or mostly support your direction?',
  'What accountability rhythm works best for you — daily nudges, weekly reviews, monthly check-ins, or milestone-based only?',
  'Any boundaries on tone, topics, or delivery style I should know about?',
];

const extractAgentReply = (payload) => {
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
  if (typeof payload.question === 'string' && payload.question.trim()) return payload.question.trim();
  return '';
};

const isCalibrationLinkDisrupted = (text) => {
  if (typeof text !== 'string' || !text.trim()) return false;
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, ' ');
  return (
    normalized.includes('calibration') &&
    (normalized.includes('disrupt') || normalized.includes('retry'))
  );
};

const IntroScreen = ({ firstName, onStart }) => (
  <div className="h-screen flex flex-col items-center justify-center px-6 text-center"
    style={{ background: 'var(--canvas-app, #FAFAFA)' }}>
    <style>{`@keyframes agentPulse{0%,100%{transform:scale(1);opacity:0.7}50%{transform:scale(1.08);opacity:1}}`}</style>

    {/* Animated agent icon */}
    <div className="relative w-20 h-20 mx-auto mb-7">
      <div className="absolute inset-0 rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #E85D00 0%, #7C3AED 100%)', animation: 'agentPulse 3s ease-in-out infinite', borderRadius: 18 }} />
      <div className="absolute inset-0.5 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--canvas-app, #FAFAFA)', borderRadius: 17 }}>
        <Brain className="w-9 h-9" style={{ color: '#E85D00' }} />
      </div>
    </div>

    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5"
      style={{ background: 'rgba(232,93,0,0.08)', border: '1px solid rgba(232,93,0,0.2)' }}>
      <span className="text-[10px] font-semibold tracking-widest uppercase"
        style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>Agent Personalisation</span>
    </div>

    <h1 className="text-2xl sm:text-3xl font-semibold mb-4 max-w-md"
      style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.display }}>
      Now we build your personalised<br />BIQc Intelligence Agent
      {firstName ? `, ${firstName}` : ''}.
    </h1>

    <p className="text-sm leading-relaxed max-w-sm mb-6"
      style={{ color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.body }}>
      We're going to ask you{' '}
      <span style={{ color: '#E85D00', fontWeight: 600 }}>6 questions</span>{' '}
      about how you think, communicate and make decisions. Your answers will be used
      to calibrate a world-class AI advisor that speaks your language, respects your
      boundaries and delivers intelligence exactly the way you need it.
    </p>

    <div className="grid grid-cols-3 gap-3 max-w-sm w-full mb-7">
      {['Communication style', 'Risk posture', 'Strategic depth'].map((label, i) => (
        <div key={i} className="rounded-xl p-3 text-center"
          style={{ background: 'rgba(232,93,0,0.06)', border: '1px solid rgba(232,93,0,0.15)' }}>
          <p className="text-[10px] leading-snug" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.body }}>{label}</p>
        </div>
      ))}
    </div>

    <p className="text-xs mb-6" style={{ color: '#64748B', fontFamily: fontFamily.body }}>
      Takes about 2 minutes · Your answers are private · Used only to personalise your agent
    </p>

    <button onClick={onStart}
      className="px-10 py-3.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:brightness-110"
      style={{ background: 'linear-gradient(135deg, #E85D00, #E56A08)', color: 'white', fontFamily: fontFamily.body, boxShadow: '0 8px 28px rgba(232,93,0,0.28)' }}
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
  const [dynamicOptions, setDynamicOptions] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startChat = async () => {
    setPhase('chat');
    setSending(true);
    try {
      const data = await callEdge({ message: 'init', step: 0, history: [] });
      const agentText = extractAgentReply(data) || FALLBACK_QUESTIONS[0];
      setMessages([{ role: 'agent', text: agentText }]);
      setStep(data.step || 1);
      setPct(data.percentage || 0);
      setDynamicOptions(Array.isArray(data.options) ? data.options : []);
    } catch {
      setMessages([{ role: 'agent', text: FALLBACK_QUESTIONS[0] }]);
      setStep(1);
      setDynamicOptions([]);
    }
    setSending(false);
  };

  const progressWithFallback = (currentStepValue) => {
    const currentStep = Math.max(1, Number(currentStepValue) || 1);
    if (currentStep >= TOTAL_STEPS) {
      setPct(100);
      setDynamicOptions([]);
      setMessages(prev => [...prev, {
        role: 'agent',
        text: 'Calibration complete — your BIQc Intelligence Agent now understands how you think, decide, and communicate. Preparing your personalised advisory experience…',
      }]);
      setTimeout(() => setPhase('done'), 1200);
      setTimeout(() => onComplete(), 2600);
      return;
    }
    const nextStep = currentStep + 1;
    const nextQuestion = FALLBACK_QUESTIONS[nextStep - 1] || FALLBACK_QUESTIONS[FALLBACK_QUESTIONS.length - 1];
    setStep(nextStep);
    setPct(Math.round(((nextStep - 1) / TOTAL_STEPS) * 100));
    setDynamicOptions([]);
    setMessages(prev => [...prev, { role: 'agent', text: `Understood. ${nextQuestion}` }]);
  };

  const sendMessage = async (overrideText = null) => {
    const userMsg = (overrideText || input).trim();
    if (!userMsg || sending) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setSending(true);
    setDynamicOptions([]);

    try {
      const history = messages.map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.text }));
      const data = await callEdge({ message: userMsg, step, history });
      const agentText = extractAgentReply(data) || "I didn't catch that — could you rephrase your answer?";

      if (isCalibrationLinkDisrupted(agentText)) {
        progressWithFallback(step);
      } else {
        setMessages(prev => [...prev, { role: 'agent', text: agentText }]);
        setStep(data.step || step);
        setPct(data.percentage || pct);
        setDynamicOptions(Array.isArray(data.options) ? data.options : []);
      }

      if (data.status === 'COMPLETE') {
        setDynamicOptions([]);
        setPct(100);
        setMessages(prev => [...prev, {
          role: 'agent',
          text: 'Your Intelligence Agent is now fully calibrated. Every insight, challenge, and recommendation will be tuned to how you operate. Let\'s get to work.',
        }]);
        setTimeout(() => setPhase('done'), 1500);
        setTimeout(() => onComplete(), 3000);
      }
    } catch {
      progressWithFallback(step);
    }
    setSending(false);
  };

  if (phase === 'intro') return <IntroScreen firstName={firstName} onStart={startChat} />;

  if (phase === 'done') {
    return (
      <div className="h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: 'var(--canvas-app, #FAFAFA)' }}>
        <div className="w-16 h-16 rounded-full mb-6 flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.4)' }}>
          <Brain className="w-8 h-8" style={{ color: '#10B981' }} />
        </div>
        <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.display }}>
          Agent calibrated.
        </h2>
        <p className="text-sm max-w-xs" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.body }}>
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
    <div className="h-screen flex flex-col" style={{ background: 'var(--canvas-app, #FAFAFA)' }}>

      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border, rgba(10,10,10,0.08))' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(232,93,0,0.1)', border: '1px solid rgba(232,93,0,0.2)' }}>
              <Brain className="w-4 h-4" style={{ color: '#E85D00' }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.body }}>
                BIQc Agent Calibration
              </p>
              <p className="text-[10px]" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
                Step {Math.min(step, TOTAL_STEPS)} of {TOTAL_STEPS} — {currentStepLabel}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>
            {pct}%
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1 rounded-full" style={{ background: 'var(--border, rgba(10,10,10,0.08))' }}>
          <div className="h-1 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #E85D00, #E56A08)' }} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'agent' && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-2.5 mt-0.5"
                style={{ background: 'rgba(232,93,0,0.15)' }}>
                <Brain className="w-3.5 h-3.5" style={{ color: '#E85D00' }} />
              </div>
            )}
            <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed`}
              style={{
                background: msg.role === 'user' ? 'rgba(232,93,0,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(232,93,0,0.2)' : 'rgba(255,255,255,0.06)'}`,
                color: 'var(--ink-display, #0A0A0A)',
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
              style={{ background: 'rgba(232,93,0,0.15)' }}>
              <Brain className="w-3.5 h-3.5" style={{ color: '#E85D00' }} />
            </div>
            <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#E85D00', opacity: 0.5, animation: `bounce ${0.8 + i * 0.15}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Dynamic multiple choice options */}
      {!sending && step >= 1 && step <= TOTAL_STEPS && dynamicOptions.length > 0 && (
        <div className="flex-shrink-0 px-4 pt-3" style={{ borderTop: '1px solid var(--border, rgba(10,10,10,0.08))' }}>
          <p className="text-[10px] mb-2" style={{ color: '#4A5568', fontFamily: fontFamily.mono }}>
            Choose an option or type your own answer below
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {dynamicOptions.map((opt, i) => (
              <button key={i} onClick={() => sendMessage(opt)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: 'rgba(232,93,0,0.08)',
                  border: '1px solid rgba(232,93,0,0.2)',
                  color: 'var(--ink-display, #0A0A0A)',
                  fontFamily: fontFamily.body,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,93,0,0.16)'; e.currentTarget.style.borderColor = 'rgba(232,93,0,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(232,93,0,0.08)'; e.currentTarget.style.borderColor = 'rgba(232,93,0,0.2)'; }}
                data-testid={`choice-${i}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-5 pt-2">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Or type your own answer…"
            rows={1}
            className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: 'var(--surface, #FFFFFF)',
              border: '1px solid rgba(140,170,210,0.15)',
              color: 'var(--ink-display, #0A0A0A)',
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
              background: input.trim() && !sending ? 'linear-gradient(135deg, #E85D00, #E56A08)' : 'var(--border, rgba(10,10,10,0.08))',
              color: input.trim() && !sending ? 'white' : '#4A5568',
            }}
            data-testid="agent-calibration-send">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentCalibrationChat;
