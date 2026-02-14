import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { apiClient } from "../lib/api";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const CalibrationAdvisor = () => {
  const navigate = useNavigate();
  const { user, session, loading } = useSupabaseAuth();

  const [phase, setPhase] = useState("idle"); // idle | active | complete
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const initCalled = useRef(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) navigate("/login-supabase");
  }, [loading, user, navigate]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // On mount: check if already complete → redirect. Otherwise, init calibration.
  useEffect(() => {
    if (!loading && user && session && !initCalled.current) {
      initCalled.current = true;
      apiClient.get('/calibration/status')
        .then(res => {
          if (res.data?.status === 'COMPLETE') {
            window.location.href = '/advisor';
          } else {
            initCalibration();
          }
        })
        .catch(() => {
          // Fail-open: attempt calibration init
          initCalibration();
        });
    }
  }, [loading, user, session]);

  /** Transport: POST to Edge Function. Returns { message, status } */
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

  /** Init: send empty payload to Edge Function */
  const initCalibration = async () => {
    setError(null);
    try {
      const data = await callEdge({});

      if (data.status === "COMPLETE") {
        window.location.href = "/advisor";
        return;
      }

      if (data.message) {
        setMessages([{ role: "edge", text: data.message }]);
      }
      setPhase("active");
    } catch {
      setError("Calibration engine temporarily unavailable.");
    }
  };

  /** Submit: send exact user message to Edge Function */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || phase !== "active" || !inputValue.trim()) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setError(null);
    setIsSubmitting(true);

    const updated = [...messages, { role: "user", text: userMessage }];
    setMessages(updated);

    try {
      const data = await callEdge({ message: userMessage });

      if (data.message) {
        setMessages([...updated, { role: "edge", text: data.message }]);
      }

      if (data.status === "COMPLETE") {
        setPhase("complete");
        window.location.href = "/advisor";
        return;
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
      {/* Header — minimal */}
      <header className="px-6 sm:px-8 py-4 border-b border-white/10">
        <h1 className="text-base font-semibold tracking-tight text-white/80 font-mono" data-testid="calibration-header">
          CALIBRATION
        </h1>
      </header>

      {/* Main area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4" data-testid="calibration-messages">

          {/* Loading state before Edge responds */}
          {phase === "idle" && !error && (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          )}

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
            <div className="flex justify-start" data-testid="calibration-loading">
              <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                <div className="w-4 h-4 border border-white/20 border-t-white/50 rounded-full animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="px-4 sm:px-8 py-3" data-testid="calibration-error">
            <p className="text-sm text-red-400/80">{error}</p>
          </div>
        )}

        {/* Input — only when active */}
        {phase === "active" && (
          <form onSubmit={handleSubmit} className="px-4 sm:px-8 py-4 border-t border-white/10" data-testid="calibration-form">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                inputMode="text"
                enterKeyHint="send"
                autoComplete="off"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder=""
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
        )}
      </main>
    </div>
  );
};

export default CalibrationAdvisor;
