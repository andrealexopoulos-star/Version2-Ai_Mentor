import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;

const CalibrationAdvisor = () => {
  const navigate = useNavigate();
  const { user, session, loading, supabase } = useSupabaseAuth();

  const [phase, setPhase] = useState("welcome");
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const welcomeText = useMemo(() => {
    const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.full_name;
    if (!fullName) return "Welcome.";
    const firstName = fullName.includes("@") ? fullName.split("@")[0] : fullName.split(" ")[0];
    return firstName ? `Welcome, ${firstName}.` : "Welcome.";
  }, [user]);

  useEffect(() => {
    if (!loading && !user) navigate("/login-supabase");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, phase]);

  const stepLabel = useMemo(() => {
    if (phase === "welcome") return "PERSONA CALIBRATION";
    if (phase === "initializing") return "SYNCING...";
    if (phase === "complete") return "CALIBRATION COMPLETE";
    if (currentStep > 0) return `STEP ${currentStep} OF 9 · ${progress}%`;
    return "CALIBRATION · ACTIVE";
  }, [phase, currentStep, progress]);

  /** Call the Supabase Edge Function */
  const callEdgeFunction = async (message) => {
    console.log('[calibration-psych] Getting session...');
    const { data: { session: activeSession } } = await supabase.auth.getSession();
    const token = activeSession?.access_token;
    if (!token) {
      console.error('[calibration-psych] No session token available');
      throw new Error("No session");
    }

    const url = `${SUPABASE_URL}/functions/v1/calibration-psych`;
    const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
    console.log('[calibration-psych] Calling:', url);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "apikey": ANON_KEY,
      },
      body: JSON.stringify({ message }),
    });

    console.log('[calibration-psych] Response status:', res.status);

    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch { errText = 'Could not read error'; }
      console.error('[calibration-psych] Error:', res.status, errText);
      throw new Error(`Edge Function error ${res.status}: ${errText.substring(0, 100)}`);
    }
    const data = await res.json();
    console.log('[calibration-psych] Response:', data);
    return data;
  };

  /** Back button handler — go back one step or to welcome */
  const handleBack = () => {
    if (phase === "active" && messages.length <= 1) {
      setPhase("welcome");
      setMessages([]);
      setCurrentStep(0);
      setProgress(0);
    } else if (phase === "active" && messages.length > 1) {
      // Remove last exchange (user + advisor)
      const trimmed = messages.slice(0, -2);
      setMessages(trimmed);
      setCurrentStep(Math.max(currentStep - 1, 1));
      setProgress(Math.max(progress - 11, 0));
    }
  };

  // On mount: check if already complete → redirect immediately
  useEffect(() => {
    if (!loading && user && supabase) {
      const uid = user.id || session?.user?.id;
      if (!uid) return;
      supabase.from('user_operator_profile')
        .select('persona_calibration_status')
        .eq('user_id', uid)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.persona_calibration_status === 'complete') {
            console.log('[calibration-psych] Already complete → redirecting to /biqc-insights');
            window.location.href = '/biqc-insights';
          }
        });
    }
  }, [loading, user, supabase, session]);

  const handleBegin = async () => {
    console.log('[calibration-psych] Begin clicked');
    setPhase("initializing");
    setInlineError(null);

    try {
      const data = await callEdgeFunction("[SYSTEM_INIT_CALIBRATION]");

      // If already complete, redirect immediately
      if (data.status === "COMPLETE") {
        console.log('[calibration-psych] Already complete → redirecting');
        window.location.href = "/biqc-insights";
        return;
      }

      setMessages([{ role: "advisor", text: data.message }]);
      setCurrentStep(data.step || 1);
      setProgress(data.percentage || 0);
      setPhase("active");
    } catch (err) {
      console.error("[calibration-psych] Init failed:", err);
      setPhase("welcome");
      setInlineError(`Could not start calibration: ${err.message}`);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || phase !== "active" || !inputValue.trim()) return;

    const trimmed = inputValue.trim();
    setInputValue("");
    setInlineError(null);
    setIsSubmitting(true);

    const newMessages = [...messages, { role: "user", text: trimmed }];
    setMessages(newMessages);

    try {
      const data = await callEdgeFunction(trimmed);

      setMessages([...newMessages, { role: "advisor", text: data.message }]);
      setCurrentStep(data.step || currentStep);
      setProgress(data.percentage || progress);

      if (data.status === "COMPLETE") {
        setPhase("complete");
        setProgress(100);
        // Full page reload to /advisor — forces fresh auth bootstrap
        // which will see persona_calibration_status = 'complete'
        setTimeout(() => {
          window.location.href = "/advisor";
        }, 4000);
      }
    } catch (err) {
      console.error("[calibration-psych] Error:", err);
      setInlineError("Signal lost. Please try again.");
      setInputValue(trimmed);
    } finally {
      setIsSubmitting(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080c14] via-[#0f172a] to-[#162032] text-white flex flex-col">
      {/* Header with back arrow */}
      <header className="px-6 sm:px-8 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {phase !== "welcome" && phase !== "complete" && (
            <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Go back">
              <ArrowLeft size={18} className="text-white/60" />
            </button>
          )}
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white font-mono">BIQc CALIBRATION</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-amber-500/50 bg-amber-500/10 px-2 py-0.5 rounded">v2-EDGE</span>
          <span className="text-[11px] font-medium text-emerald-400/60 tracking-widest uppercase font-mono">{stepLabel}</span>
        </div>
      </header>

      {/* Progress bar */}
      {(phase === "active" || phase === "complete") && (
        <div className="h-1 bg-white/5">
          <div className="h-full bg-emerald-400 transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* ── WELCOME SCREEN ── */}
      {phase === "welcome" && (
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-xl w-full space-y-8 text-center">
            <div className="bg-black/40 border border-white/10 rounded-2xl px-8 py-10 text-left space-y-4">
              <p className="text-xs font-mono text-emerald-400/70 tracking-wider mb-2">PERSONA CALIBRATION</p>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">{welcomeText}</p>
              <p className="text-base font-semibold text-white/90">Before I can advise you, I need to understand how you operate.</p>
              <p className="text-sm leading-relaxed text-white/70">9 questions about your working style, preferences, and boundaries. This calibrates my communication to match your operating mode.</p>
              <p className="text-sm leading-relaxed text-white/50 italic">This is about you — not your business.</p>
            </div>
            {inlineError && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-left">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{inlineError}</p>
              </div>
            )}
            <button onClick={handleBegin} className="w-full sm:w-auto px-10 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-base font-semibold transition-colors shadow-lg shadow-blue-500/20">
              Begin Calibration
            </button>
          </div>
        </main>
      )}

      {/* ── ACTIVE CONVERSATION ── */}
      {(phase === "active" || phase === "initializing") && (
        <main className="flex-1 flex flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4">
            {phase === "initializing" && (
              <div className="flex justify-center py-12">
                <span className="text-emerald-400/50 text-xs tracking-widest animate-pulse font-mono">ESTABLISHING LINK...</span>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] sm:max-w-[70%] px-4 py-3 rounded-xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600/20 border border-blue-500/20 text-white"
                    : "bg-white/8 border border-white/15 text-white"
                }`}>
                  {msg.role !== "user" && <p className="text-[10px] font-mono text-emerald-400/60 mb-1 tracking-wider">CALIBRATION AGENT</p>}
                  <p className="whitespace-pre-wrap text-white">{msg.text}</p>
                </div>
              </div>
            ))}

            {isSubmitting && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <span className="text-emerald-400/40 text-xs tracking-widest animate-pulse font-mono">PROCESSING...</span>
                </div>
              </div>
            )}
          </div>

          {phase === "active" && (
            <form onSubmit={handleSubmit} className="px-4 sm:px-8 py-4 border-t border-white/10">
              {inlineError && (
                <div className="flex items-center gap-2 mb-2 text-red-400 text-xs">
                  <AlertCircle size={12} /> {inlineError}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="text"
                  enterKeyHint="send"
                  autoComplete="off"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your answer..."
                  disabled={isSubmitting}
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-base text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !inputValue.trim()}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-400 disabled:opacity-30 rounded-xl text-sm font-semibold text-white transition-colors"
                >
                  Send
                </button>
              </div>
            </form>
          )}
        </main>
      )}

      {/* ── COMPLETION SCREEN ── */}
      {phase === "complete" && (
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-lg w-full text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-white">Calibration Complete</h2>
              <p className="text-base text-white/70 leading-relaxed">
                Thank you for taking the time to calibrate your agent. Your preferences have been saved and your AI advisor is now tuned to your operating style.
              </p>
              <p className="text-sm text-white/50">
                You'll now be directed to your advisor dashboard where we'll walk you through the key features.
              </p>
            </div>
            <div className="pt-4">
              <div className="flex items-center justify-center gap-2 text-emerald-400/60 text-sm">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Redirecting to your dashboard...
              </div>
            </div>
            <button
              onClick={() => window.location.href = "/advisor"}
              className="mt-4 px-8 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors"
            >
              Go to Dashboard Now
            </button>
          </div>
        </main>
      )}
    </div>
  );
};

export default CalibrationAdvisor;
