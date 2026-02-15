import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { apiClient } from "../lib/api";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const CalibrationAdvisor = () => {
  const navigate = useNavigate();
  const { user, session, loading } = useSupabaseAuth();

  // Wizard mode state (structured: question + options)
  const [phase, setPhase] = useState("idle"); // idle | wizard | chat
  const [currentStep, setCurrentStep] = useState(1);
  const [question, setQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [allowText, setAllowText] = useState(false);
  const [insight, setInsight] = useState(null);
  const [isProbe, setIsProbe] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [textValue, setTextValue] = useState("");

  // Chat mode state (legacy: message string)
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const initCalled = useRef(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login-supabase");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // On mount: check status, then init calibration
  useEffect(() => {
    if (!loading && user && session && !initCalled.current) {
      initCalled.current = true;

      const init = async () => {
        try {
          const res = await apiClient.get('/calibration/status');
          if (res.data?.status === 'COMPLETE') {
            window.location.href = '/advisor';
            return;
          }
        } catch { /* proceed */ }

        try {
          const data = await callEdge({ step: 1 });
          if (data.status === "COMPLETE") {
            window.location.href = "/advisor";
            return;
          }
          applyResponse(data);
        } catch {
          setError("Calibration engine temporarily unavailable.");
        }
      };

      init();
    }
  }, [loading, user, session]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Transport: POST to Edge Function */
  const callEdge = async (payload) => {
    const token = session?.access_token;
    if (!token) throw new Error("No session");

    const res = await fetch(`${SUPABASE_URL}/functions/v1/calibration-psych`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "apikey": ANON_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch { /* ignore */ }
      throw new Error(`${res.status}: ${errText.substring(0, 120)}`);
    }
    return await res.json();
  };

  /** Detect response format and apply to correct mode */
  const applyResponse = (data) => {
    // If Edge returns structured wizard format (question + options)
    if (data.question && data.options && data.options.length > 0) {
      setQuestion(data.question);
      setOptions(data.options);
      setAllowText(data.allow_text === true);
      setInsight(data.insight || null);
      setIsProbe(data.probe === true);
      setSelectedOption(null);
      setTextValue("");
      if (!data.probe) setCurrentStep(prev => data.step || prev + 1);
      setPhase("wizard");
      return;
    }

    // Legacy/chat format (message string)
    if (data.message) {
      setMessages(prev => [...prev, { role: "edge", text: data.message }]);
      setPhase("chat");
      return;
    }

    // Fallback: render whatever came back
    const fallbackText = data.text || data.response || data.reply || JSON.stringify(data);
    if (fallbackText) {
      setMessages(prev => [...prev, { role: "edge", text: fallbackText }]);
      setPhase("chat");
    }
  };

  /** Wizard mode: Continue with selected option */
  const handleWizardContinue = async () => {
    if (isSubmitting || !selectedOption) return;
    setError(null);
    setIsSubmitting(true);

    const payload = { step: currentStep, selected: selectedOption };
    if (textValue.trim()) payload.text = textValue.trim();
    if (isProbe) payload.probe = true;

    try {
      const data = await callEdge(payload);
      if (data.status === "COMPLETE") {
        window.location.href = "/advisor";
        return;
      }
      applyResponse(data);
    } catch {
      setError("Calibration engine temporarily unavailable.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Chat mode: Send message */
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !inputValue.trim()) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setError(null);
    setIsSubmitting(true);
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);

    try {
      const data = await callEdge({ message: userMessage });
      if (data.message) {
        setMessages(prev => [...prev, { role: "edge", text: data.message }]);
      }
      if (data.status === "COMPLETE") {
        window.location.href = "/advisor";
        return;
      }
      // Check if Edge switched to wizard mode mid-conversation
      if (data.question && data.options?.length > 0) {
        applyResponse(data);
      }
    } catch {
      setError("Calibration engine temporarily unavailable.");
      setInputValue(userMessage);
    } finally {
      setIsSubmitting(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-white flex flex-col" data-testid="calibration-page">
      <header className="px-6 sm:px-8 py-4 border-b border-white/10">
        <h1 className="text-base font-semibold tracking-tight text-white/80 font-mono" data-testid="calibration-header">
          CALIBRATION
        </h1>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ── LOADING ── */}
        {phase === "idle" && !error && (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        {/* ── ERROR ── */}
        {error && (
          <div className="flex-1 flex items-center justify-center px-4">
            <p className="text-sm text-red-400/80" data-testid="calibration-error">{error}</p>
          </div>
        )}

        {/* ── WIZARD MODE (structured: question + options) ── */}
        {phase === "wizard" && !error && (
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8">
            <div className="w-full max-w-2xl mx-auto space-y-6">
              {insight && (
                <div className="bg-white/5 border border-white/8 rounded-lg px-5 py-4" data-testid="calibration-insight">
                  <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{insight}</p>
                </div>
              )}

              {question && (
                <div data-testid="calibration-question">
                  <p className="text-base text-white leading-relaxed whitespace-pre-wrap">{question}</p>
                </div>
              )}

              {options.length > 0 && (
                <div className="space-y-2" data-testid="calibration-options">
                  {options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedOption(opt)}
                      disabled={isSubmitting}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ${
                        selectedOption === opt
                          ? "bg-white/15 border border-white/25 text-white"
                          : "bg-white/5 border border-white/8 text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                      data-testid={`calibration-option-${i}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {allowText && (
                <textarea
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 resize-none"
                  data-testid="calibration-textarea"
                />
              )}

              <button
                onClick={handleWizardContinue}
                disabled={isSubmitting || !selectedOption}
                className="px-8 py-3 bg-white/10 hover:bg-white/15 disabled:opacity-20 rounded-lg text-sm font-medium text-white transition-colors"
                data-testid="calibration-continue-btn"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border border-white/20 border-t-white/50 rounded-full animate-spin mx-auto" />
                ) : "Continue"}
              </button>
            </div>
          </div>
        )}

        {/* ── CHAT MODE (legacy: message string) ── */}
        {phase === "chat" && !error && (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4" data-testid="calibration-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`message-${i}`}>
                  <div className={`max-w-[85%] sm:max-w-[70%] px-4 py-3 rounded-xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-white/10 border border-white/10 text-white"
                      : "bg-white/5 border border-white/8 text-white/90"
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}

              {isSubmitting && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                    <div className="w-4 h-4 border border-white/20 border-t-white/50 rounded-full animate-spin" />
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="px-4 sm:px-8 py-4 border-t border-white/10" data-testid="calibration-form">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="text"
                  enterKeyHint="send"
                  autoComplete="off"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={isSubmitting}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-base text-white placeholder-white/20 focus:outline-none focus:border-white/25"
                  autoFocus
                  data-testid="calibration-input"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !inputValue.trim()}
                  className="px-6 py-3 bg-white/10 hover:bg-white/15 disabled:opacity-20 rounded-lg text-sm font-medium text-white transition-colors"
                  data-testid="calibration-send-btn"
                >
                  Send
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
};

export default CalibrationAdvisor;
