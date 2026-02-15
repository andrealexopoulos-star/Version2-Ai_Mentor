import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { apiClient } from "../lib/api";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

/* ── Shared Gilded Styles ── */
const CREAM = '#FBFBF9';
const CHARCOAL = '#1E293B';
const MUTED = '#64748B';
const GOLD = '#B8860B';
const CARD_BG = '#FFFFFF';
const CARD_BORDER = '#E8E6E1';
const SERIF = "'Playfair Display', serif";

const CalibrationAdvisor = () => {
  const navigate = useNavigate();
  const { user, session, loading } = useSupabaseAuth();

  // Entry state: loading | welcome | continuity | calibrating
  const [entry, setEntry] = useState("loading");
  const [userName, setUserName] = useState("");
  const [calStep, setCalStep] = useState(0);

  // Calibration state (wizard + chat dual mode)
  const [question, setQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [allowText, setAllowText] = useState(false);
  const [insight, setInsight] = useState(null);
  const [isProbe, setIsProbe] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [textValue, setTextValue] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [calMode, setCalMode] = useState(null); // wizard | chat
  const [currentStep, setCurrentStep] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const initCalled = useRef(false);

  const firstName = userName?.split(' ')[0] || user?.full_name?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || '';

  useEffect(() => {
    if (!loading && !user) navigate("/login-supabase");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Determine psychological state on mount
  useEffect(() => {
    if (!loading && user && session && !initCalled.current) {
      initCalled.current = true;
      detectState();
    }
  }, [loading, user, session]); // eslint-disable-line react-hooks/exhaustive-deps

  const detectState = async () => {
    try {
      const res = await apiClient.get('/calibration/status');
      const d = res.data;
      setUserName(d.user_name || '');

      if (d.status === 'COMPLETE') {
        window.location.href = '/advisor';
        return;
      }
      if (d.status === 'IN_PROGRESS' && d.calibration_step > 0) {
        setCalStep(d.calibration_step);
        setEntry("continuity");
        return;
      }
      setEntry("welcome");
    } catch {
      setEntry("welcome");
    }
  };

  /** Transport: POST to Edge Function */
  const callEdge = async (payload) => {
    const token = session?.access_token;
    if (!token) throw new Error("No session");
    const res = await fetch(`${SUPABASE_URL}/functions/v1/calibration-psych`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "apikey": ANON_KEY },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch { /* */ }
      throw new Error(`${res.status}: ${errText.substring(0, 120)}`);
    }
    return await res.json();
  };

  /** Detect response format and apply */
  const applyResponse = (data) => {
    if (data.question && data.options && data.options.length > 0) {
      setQuestion(data.question);
      setOptions(data.options);
      setAllowText(data.allow_text === true);
      setInsight(data.insight || null);
      setIsProbe(data.probe === true);
      setSelectedOption(null);
      setTextValue("");
      if (!data.probe) setCurrentStep(prev => data.step || prev + 1);
      setCalMode("wizard");
      setEntry("calibrating");
      return;
    }
    if (data.message) {
      setMessages(prev => [...prev, { role: "edge", text: data.message }]);
      setCalMode("chat");
      setEntry("calibrating");
      return;
    }
    const fb = data.text || data.response || JSON.stringify(data);
    if (fb) {
      setMessages(prev => [...prev, { role: "edge", text: fb }]);
      setCalMode("chat");
      setEntry("calibrating");
    }
  };

  /** Begin calibration (from Welcome or Continuity) */
  const startCalibration = async () => {
    setError(null);
    setEntry("calibrating");
    try {
      const data = await callEdge({ step: calStep > 0 ? calStep : 1 });
      if (data.status === "COMPLETE") { window.location.href = "/advisor"; return; }
      applyResponse(data);
    } catch {
      setError("Calibration engine temporarily unavailable.");
    }
  };

  /** Wizard: Continue */
  const handleWizardContinue = async () => {
    if (isSubmitting || !selectedOption) return;
    setError(null);
    setIsSubmitting(true);
    const payload = { step: currentStep, selected: selectedOption };
    if (textValue.trim()) payload.text = textValue.trim();
    if (isProbe) payload.probe = true;
    try {
      const data = await callEdge(payload);
      if (data.status === "COMPLETE") { window.location.href = "/advisor"; return; }
      applyResponse(data);
    } catch { setError("Calibration engine temporarily unavailable."); }
    finally { setIsSubmitting(false); }
  };

  /** Chat: Send */
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !inputValue.trim()) return;
    const msg = inputValue.trim();
    setInputValue(""); setError(null); setIsSubmitting(true);
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    try {
      const data = await callEdge({ message: msg });
      if (data.message) setMessages(prev => [...prev, { role: "edge", text: data.message }]);
      if (data.status === "COMPLETE") { window.location.href = "/advisor"; return; }
      if (data.question && data.options?.length > 0) applyResponse(data);
    } catch { setError("Calibration engine temporarily unavailable."); setInputValue(msg); }
    finally { setIsSubmitting(false); inputRef.current?.focus(); }
  };

  // Progress ring for Continuity Suite
  const progressPercent = Math.min(Math.round((calStep / 9) * 100), 99);
  const ringRadius = 52;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (progressPercent / 100) * ringCirc;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: CREAM }} data-testid="calibration-page">

      {/* ── LOADING ── */}
      {entry === "loading" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border rounded-full animate-spin" style={{ borderColor: CARD_BORDER, borderTopColor: CHARCOAL }} />
        </div>
      )}

      {/* ── STATE A: WELCOME ROOM (New User) ── */}
      {entry === "welcome" && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-lg w-full text-center">
            <h1 className="text-3xl sm:text-4xl mb-4" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 600 }}>
              {firstName ? `Welcome, ${firstName}.` : 'Welcome to BIQc.'}
            </h1>
            <p className="text-base leading-relaxed mb-8" style={{ color: MUTED, maxWidth: 440, margin: '0 auto' }}>
              I am your strategic advisor. Before I can serve you effectively, I need to understand how you operate — your decision style, your risk tolerance, and what matters most to you.
            </p>
            <p className="text-sm mb-10" style={{ color: '#94A3B8' }}>
              This takes a few minutes. Your responses shape every insight I deliver.
            </p>
            {error && <p className="text-sm text-red-500 mb-4" data-testid="calibration-error">{error}</p>}
            <button
              onClick={startCalibration}
              className="px-8 py-3 rounded-full text-sm font-medium transition-colors"
              style={{ background: CHARCOAL, color: '#FFFFFF' }}
              data-testid="begin-calibration-btn"
            >
              Begin Calibration
            </button>
          </div>
        </div>
      )}

      {/* ── STATE B: CONTINUITY SUITE (Partial User) ── */}
      {entry === "continuity" && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-lg w-full text-center">
            {/* Progress Ring */}
            <div className="mx-auto mb-8" style={{ width: 120, height: 120 }}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={ringRadius} fill="none" stroke={CARD_BORDER} strokeWidth="4" />
                <circle cx="60" cy="60" r={ringRadius} fill="none" stroke={GOLD} strokeWidth="4"
                  strokeDasharray={ringCirc} strokeDashoffset={ringOffset}
                  strokeLinecap="round" transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dashoffset 1s ease' }} />
                <text x="60" y="60" textAnchor="middle" dominantBaseline="central"
                  style={{ fontFamily: SERIF, fontSize: '24px', fontWeight: 600, fill: CHARCOAL }}>
                  {progressPercent}%
                </text>
              </svg>
            </div>

            <h1 className="text-3xl sm:text-4xl mb-4" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 600 }}>
              {firstName ? `${firstName}, you are nearly there.` : 'You are nearly there.'}
            </h1>
            <p className="text-base leading-relaxed mb-8" style={{ color: MUTED, maxWidth: 480, margin: '0 auto' }}>
              I have already begun mapping your Strategic DNA, but I need the final calibration steps to ensure your Business Pulse and Intelligence Memos reach full accuracy.
            </p>
            <p className="text-sm mb-10" style={{ color: '#94A3B8' }}>
              Step {calStep} of 9 completed. Shall we finish the final stages now?
            </p>
            {error && <p className="text-sm text-red-500 mb-4" data-testid="calibration-error">{error}</p>}
            <button
              onClick={startCalibration}
              className="px-8 py-3 rounded-full text-sm font-medium transition-colors"
              style={{ background: CHARCOAL, color: '#FFFFFF' }}
              data-testid="continue-calibration-btn"
            >
              Complete Final Stages
            </button>
          </div>
        </div>
      )}

      {/* ── CALIBRATING (Active Session) ── */}
      {entry === "calibrating" && (
        <>
          {/* Header */}
          <header className="px-6 sm:px-8 py-4" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
            <h1 className="text-sm font-medium tracking-wide uppercase" style={{ color: MUTED, letterSpacing: '0.12em' }}>
              Calibration
            </h1>
          </header>

          {/* Loading before Edge responds */}
          {!calMode && !error && (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 border rounded-full animate-spin" style={{ borderColor: CARD_BORDER, borderTopColor: CHARCOAL }} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex-1 flex items-center justify-center px-4">
              <p className="text-sm" style={{ color: '#EF4444' }} data-testid="calibration-error">{error}</p>
            </div>
          )}

          {/* Wizard Mode */}
          {calMode === "wizard" && !error && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8">
              <div className="w-full max-w-2xl mx-auto space-y-6">
                {insight && (
                  <div className="rounded-xl px-5 py-4" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
                    <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{insight}</p>
                  </div>
                )}
                {question && (
                  <p className="text-base leading-relaxed" style={{ color: CHARCOAL }} data-testid="calibration-question">{question}</p>
                )}
                {options.length > 0 && (
                  <div className="space-y-2" data-testid="calibration-options">
                    {options.map((opt, i) => (
                      <button key={i} onClick={() => setSelectedOption(opt)} disabled={isSubmitting}
                        className="w-full text-left px-4 py-3 rounded-xl text-sm transition-colors"
                        style={{
                          background: selectedOption === opt ? '#F0F4FF' : CARD_BG,
                          border: `1px solid ${selectedOption === opt ? '#93C5FD' : CARD_BORDER}`,
                          color: CHARCOAL,
                        }}
                        data-testid={`calibration-option-${i}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {allowText && (
                  <textarea value={textValue} onChange={(e) => setTextValue(e.target.value)} disabled={isSubmitting} rows={3}
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                    style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: CHARCOAL }}
                    data-testid="calibration-textarea" />
                )}
                <button onClick={handleWizardContinue} disabled={isSubmitting || !selectedOption}
                  className="px-8 py-3 rounded-full text-sm font-medium transition-opacity disabled:opacity-30"
                  style={{ background: CHARCOAL, color: '#FFFFFF' }}
                  data-testid="calibration-continue-btn">
                  {isSubmitting ? 'Processing...' : 'Continue'}
                </button>
              </div>
            </div>
          )}

          {/* Chat Mode */}
          {calMode === "chat" && !error && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4" data-testid="calibration-messages">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`message-${i}`}>
                    <div className="max-w-[85%] sm:max-w-[70%] px-4 py-3 rounded-xl text-sm leading-relaxed"
                      style={{
                        background: msg.role === "user" ? '#F0F4FF' : CARD_BG,
                        border: `1px solid ${msg.role === "user" ? '#BFDBFE' : CARD_BORDER}`,
                        color: CHARCOAL,
                      }}>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isSubmitting && (
                  <div className="flex justify-start">
                    <div className="px-4 py-3 rounded-xl" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
                      <div className="w-4 h-4 border rounded-full animate-spin" style={{ borderColor: CARD_BORDER, borderTopColor: MUTED }} />
                    </div>
                  </div>
                )}
              </div>
              <form onSubmit={handleChatSubmit} className="px-4 sm:px-8 py-4" style={{ borderTop: `1px solid ${CARD_BORDER}` }} data-testid="calibration-form">
                <div className="flex gap-2">
                  <input ref={inputRef} type="text" inputMode="text" enterKeyHint="send" autoComplete="off"
                    value={inputValue} onChange={(e) => setInputValue(e.target.value)} disabled={isSubmitting}
                    className="flex-1 rounded-xl px-4 py-3 text-base focus:outline-none"
                    style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: CHARCOAL }}
                    autoFocus data-testid="calibration-input" />
                  <button type="submit" disabled={isSubmitting || !inputValue.trim()}
                    className="px-6 py-3 rounded-xl text-sm font-medium transition-opacity disabled:opacity-30"
                    style={{ background: CHARCOAL, color: '#FFFFFF' }}
                    data-testid="calibration-send-btn">
                    Send
                  </button>
                </div>
              </form>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default CalibrationAdvisor;
