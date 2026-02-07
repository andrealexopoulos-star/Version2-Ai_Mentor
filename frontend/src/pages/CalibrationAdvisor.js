import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const apiBase = process.env.REACT_APP_BACKEND_URL
  ? process.env.REACT_APP_BACKEND_URL.replace(/\/$/, '')
  : '';

/** Authenticated fetch helper */
async function calFetch(path, { method = "GET", body, session } = {}) {
  const url = `${apiBase}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  const res = await fetch(url, {
    method,
    headers,
    credentials: "include",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  console.log(`[calibration] ${method} ${url} → ${res.status}`);
  return res;
}

const CalibrationAdvisor = () => {
  const navigate = useNavigate();
  const { user, session, loading, setCalibrationMode } = useSupabaseAuth();

  // Phase: "welcome" → "initializing" → "active" → "complete"
  const [phase, setPhase] = useState("welcome");
  const [messages, setMessages] = useState([]);    // { role: "advisor"|"user", text: string }
  const [history, setHistory] = useState([]);       // OpenAI-format history for brain
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const scrollRef = useRef(null);

  const welcomeText = useMemo(() => {
    const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.full_name;
    let firstName = null;
    if (fullName) {
      firstName = fullName.includes("@") ? fullName.split("@")[0] : fullName.split(" ")[0];
    }
    return firstName ? `Welcome, ${firstName}.` : "Welcome.";
  }, [user]);

  /* Auth guard */
  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  /* Auto-scroll */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, phase]);

  /* Step label */
  const stepLabel = useMemo(() => {
    if (phase === "welcome") return "CALIBRATION";
    if (phase === "initializing") return "SYNCING...";
    if (phase === "complete") return "CALIBRATION · COMPLETE";
    if (currentStep > 0) return `CALIBRATION · STEP ${currentStep} OF 17 · ${progress}%`;
    return "CALIBRATION · ACTIVE";
  }, [phase, currentStep, progress]);

  /* ── Begin Calibration ── */
  const handleBegin = async () => {
    setPhase("initializing");
    setInlineError(null);

    // Init business profile shell
    try {
      await calFetch("/api/calibration/init", { method: "POST", session });
    } catch (_) {}

    // Send init signal to brain
    try {
      const res = await calFetch("/api/calibration/brain", {
        method: "POST",
        session,
        body: { message: "[SYSTEM_INIT_SIGNAL]", history: [] },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const advisorMsg = data.message || "Link established. State your business identity.";
      setMessages([{ role: "advisor", text: advisorMsg }]);
      setHistory([
        { role: "assistant", content: advisorMsg }
      ]);
      setCurrentStep(data.current_step_number || 1);
      setProgress(data.percentage_complete || 0);
      setPhase("active");
    } catch (err) {
      console.error("[calibration] Brain init failed:", err);
      setPhase("welcome");
      setInlineError("Could not start calibration. Please refresh and try again.");
    }
  };

  /* ── Do This Later ── */
  const handleSkip = async () => {
    try {
      const res = await calFetch("/api/calibration/defer", { method: "POST", session });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCalibrationMode('DEFERRED');
    } catch (err) {
      console.error("[calibration] Defer failed:", err);
      toast.error("Calibration deferred locally, but server did not confirm. Resume in Settings.");
      setCalibrationMode('DEFERRED');
    }
    navigate("/advisor");
  };

  /* ── Submit message to brain ── */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || phase !== "active" || !inputValue.trim()) return;

    const trimmed = inputValue.trim();
    setInputValue("");
    setInlineError(null);
    setIsSubmitting(true);

    // Show user message immediately
    const newMessages = [...messages, { role: "user", text: trimmed }];
    setMessages(newMessages);

    // Build updated history
    const newHistory = [...history, { role: "user", content: trimmed }];

    try {
      // Also save structured answer to the legacy endpoint (best-effort, maps step to question_id)
      const questionId = Math.min(currentStep, 9);
      calFetch("/api/calibration/answer", {
        method: "POST",
        session,
        body: { question_id: questionId, answer: trimmed },
      }).catch(() => {}); // fire-and-forget

      // Send to brain
      const res = await calFetch("/api/calibration/brain", {
        method: "POST",
        session,
        body: { message: trimmed, history: newHistory },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const advisorMsg = data.message || "Vector received. Continue.";
      setMessages([...newMessages, { role: "advisor", text: advisorMsg }]);
      setHistory([...newHistory, { role: "assistant", content: advisorMsg }]);
      setCurrentStep(data.current_step_number || currentStep);
      setProgress(data.percentage_complete || progress);

      // Check for completion
      if (data.status === "COMPLETE") {
        setPhase("complete");

        // Fetch activation briefing
        try {
          const actRes = await calFetch("/api/calibration/activation", { method: "GET", session });
          if (actRes.ok) {
            const act = await actRes.json();
            const activationMessages = [];
            if (act.focus) activationMessages.push({ role: "advisor", text: act.focus });
            if (act.time_horizon) activationMessages.push({ role: "advisor", text: act.time_horizon });
            if (act.engagement) activationMessages.push({ role: "advisor", text: act.engagement });
            if (activationMessages.length > 0) {
              setMessages(prev => [...prev, ...activationMessages]);
            }
          }
        } catch (_) {}

        setTimeout(() => navigate("/advisor"), 6000);
      }
    } catch (err) {
      console.error("[calibration] Brain error:", err);
      setInlineError("Signal lost. Tap Retry to resend.");
      setInputValue(trimmed);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ══════════════ RENDER ══════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080c14] via-[#0f172a] to-[#162032] text-white flex flex-col">
      <header className="px-6 sm:px-8 py-4 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white font-mono">BIQc CALIBRATION</h1>
        <span className="text-[11px] font-medium text-emerald-400/60 tracking-widest uppercase font-mono">{stepLabel}</span>
      </header>

      {/* Progress bar */}
      {(phase === "active" || phase === "complete") && (
        <div className="h-0.5 bg-white/5">
          <div className="h-full bg-emerald-400/60 transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Welcome screen */}
      {phase === "welcome" && (
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-xl w-full space-y-8 text-center">
            <div className="bg-black/40 border border-white/10 rounded-2xl px-8 py-10 text-left space-y-4">
              <p className="text-xs font-mono text-emerald-400/70 tracking-wider mb-2">FAIL-SAFE | MASTER CONNECTED</p>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">{welcomeText}</p>
              <p className="text-base font-semibold text-white/90">Link established. Identity unverified.</p>
              <p className="text-sm leading-relaxed text-white/70">Initiating calibration protocol. I need to map your strategic position before granting Watchtower access.</p>
              <p className="text-sm leading-relaxed text-white/70">17-point strategic extraction. One vector at a time.</p>
            </div>
            {inlineError && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-left">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{inlineError}</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={handleBegin} className="px-8 py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-base font-semibold transition-colors shadow-lg shadow-blue-500/20" data-testid="calibration-begin">
                Begin Calibration
              </button>
              <button onClick={handleSkip} className="px-8 py-3.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/15 text-white/70 hover:text-white text-base font-medium transition-colors" data-testid="calibration-skip">
                Do This Later
              </button>
            </div>
          </div>
        </main>
      )}

      {/* Initializing */}
      {phase === "initializing" && (
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="flex items-center gap-3 text-white/60">
            <RefreshCw size={18} className="animate-spin" />
            <span className="text-sm font-mono">Syncing... Establishing calibration vectors.</span>
          </div>
        </main>
      )}

      {/* Active chat / Complete */}
      {(phase === "active" || phase === "complete") && (
        <main className="flex-1 flex flex-col px-6 sm:px-8 py-6 min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-1" data-testid="calibration-message-list">
            {messages.map((message, index) => {
              if (message.role === "advisor") {
                return (
                  <div key={`msg-${index}`} className="max-w-2xl rounded-2xl px-5 py-4 bg-black/50 border border-white/10 shadow-lg" data-testid={`calibration-message-${index}`}>
                    <p className="text-[15px] leading-relaxed text-white/90 whitespace-pre-line">{message.text}</p>
                  </div>
                );
              }
              return (
                <div key={`msg-${index}`} className="max-w-2xl rounded-2xl px-5 py-4 bg-blue-500 shadow-lg ml-auto" data-testid={`calibration-message-${index}`}>
                  <p className="text-[15px] leading-relaxed text-white">{message.text}</p>
                </div>
              );
            })}
          </div>

          {inlineError && (
            <div className="mt-3 flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-300 flex-1">{inlineError}</p>
            </div>
          )}

          {phase === "active" && (
            <form onSubmit={handleSubmit} className="mt-4 flex gap-3 items-center" data-testid="calibration-form">
              <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="State your response" disabled={isSubmitting} className="flex-1 rounded-xl bg-white border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-blue-400" data-testid="calibration-input" />
              <button type="submit" disabled={isSubmitting || !inputValue.trim()} className="px-5 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold disabled:opacity-40 transition-colors" data-testid="calibration-submit">
                {isSubmitting ? "..." : "Send"}
              </button>
            </form>
          )}

          {phase === "complete" && (
            <div className="mt-4 text-center">
              <p className="text-sm font-mono text-emerald-400/70">Watchtower access granted. Redirecting...</p>
            </div>
          )}
        </main>
      )}
    </div>
  );
};

export default CalibrationAdvisor;
