import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;

const CalibrationAdvisor = () => {
  const navigate = useNavigate();
  const { user, session, loading, setCalibrationMode, supabase } = useSupabaseAuth();

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
    if (phase === "complete") return "CALIBRATION · COMPLETE";
    if (currentStep > 0) return `STEP ${currentStep} OF 9 · ${progress}%`;
    return "CALIBRATION · ACTIVE";
  }, [phase, currentStep, progress]);

  /** Call the Supabase Edge Function */
  const callEdgeFunction = async (message) => {
    const { data: { session: activeSession } } = await supabase.auth.getSession();
    const token = activeSession?.access_token;
    if (!token) throw new Error("No session");

    const res = await fetch(`${SUPABASE_URL}/functions/v1/calibration-psych`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) throw new Error(`Edge Function error: ${res.status}`);
    return res.json();
  };

  const handleBegin = async () => {
    setPhase("initializing");
    setInlineError(null);

    try {
      const data = await callEdgeFunction("[SYSTEM_INIT_CALIBRATION]");
      setMessages([{ role: "advisor", text: data.message }]);
      setCurrentStep(data.step || 1);
      setProgress(data.percentage || 0);
      setPhase("active");
    } catch (err) {
      console.error("[calibration] Init failed:", err);
      setPhase("welcome");
      setInlineError("Could not start calibration. Please refresh and try again.");
    }
  };

  const handleSkip = async () => {
    try {
      // Write deferred status directly to Supabase
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user?.id) {
        // Upsert: set status to in_progress (deferred is handled client-side)
        const { error } = await supabase
          .from('user_operator_profile')
          .upsert({
            user_id: s.user.id,
            persona_calibration_status: 'incomplete',
            operator_profile: {},
            current_step: 1,
          }, { onConflict: 'user_id' });
        if (error) console.warn('[calibration] Defer upsert warn:', error);
      }
      setCalibrationMode('DEFERRED');
    } catch (_) {
      setCalibrationMode('DEFERRED');
    }
    navigate("/advisor");
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
        toast.success("Persona calibration complete.");
        setTimeout(() => navigate("/advisor"), 3000);
      }
    } catch (err) {
      console.error("[calibration] Error:", err);
      setInlineError("Signal lost. Tap Retry to resend.");
      setInputValue(trimmed);
    } finally {
      setIsSubmitting(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080c14] via-[#0f172a] to-[#162032] text-white flex flex-col">
      <header className="px-6 sm:px-8 py-4 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white font-mono">BIQc CALIBRATION</h1>
        <span className="text-[11px] font-medium text-emerald-400/60 tracking-widest uppercase font-mono">{stepLabel}</span>
      </header>

      {(phase === "active" || phase === "complete") && (
        <div className="h-0.5 bg-white/5">
          <div className="h-full bg-emerald-400/60 transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      )}

      {phase === "welcome" && (
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-xl w-full space-y-8 text-center">
            <div className="bg-black/40 border border-white/10 rounded-2xl px-8 py-10 text-left space-y-4">
              <p className="text-xs font-mono text-emerald-400/70 tracking-wider mb-2">PERSONA CALIBRATION</p>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">{welcomeText}</p>
              <p className="text-base font-semibold text-white/90">Before I can advise you, I need to understand how you operate.</p>
              <p className="text-sm leading-relaxed text-white/70">9 questions about your working style, preferences, and boundaries. This calibrates my communication to match your operating mode.</p>
              <p className="text-sm leading-relaxed text-white/50">This is about YOU — not your business.</p>
            </div>
            {inlineError && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-left">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{inlineError}</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={handleBegin} className="px-8 py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-base font-semibold transition-colors shadow-lg shadow-blue-500/20">
                Begin Calibration
              </button>
              <button onClick={handleSkip} className="px-8 py-3.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/15 text-white/70 hover:text-white text-base font-medium transition-colors">
                Do This Later
              </button>
            </div>
          </div>
        </main>
      )}

      {(phase === "active" || phase === "complete" || phase === "initializing") && (
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
                    ? "bg-blue-600/20 border border-blue-500/20 text-white/90"
                    : "bg-white/5 border border-white/10 text-white/80"
                }`}>
                  {msg.role !== "user" && <p className="text-[10px] font-mono text-emerald-400/50 mb-1 tracking-wider">CALIBRATION AGENT</p>}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
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

            {phase === "complete" && (
              <div className="flex justify-center py-6">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-6 py-4 text-center">
                  <p className="text-emerald-400 font-semibold text-sm">Persona Calibration Complete</p>
                  <p className="text-white/50 text-xs mt-1">Redirecting to your advisor...</p>
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
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your answer..."
                  disabled={isSubmitting}
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
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
    </div>
  );
};

export default CalibrationAdvisor;
