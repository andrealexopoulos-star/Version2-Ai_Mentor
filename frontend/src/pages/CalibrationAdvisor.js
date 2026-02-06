import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { Check, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const apiBase = process.env.REACT_APP_BACKEND_URL
  ? process.env.REACT_APP_BACKEND_URL.replace(/\/$/, '')
  : '';

const BASE_INITIAL_MESSAGE =
  "I'm BIQC — your strategic advisor.\nBefore I can give you meaningful insight, I need to understand the business you're responsible for.\nThis is a calibration session, not a form.\nI'll ask one question at a time.";

const FINAL_MESSAGE =
  "Calibration complete.\nI now understand the business you're responsible for.\nBIQC is ready to advise you.";

const QUESTIONS = [
  { id: 1, text: "What's the name of the business you're operating, and what industry does it sit in?" },
  { id: 2, text: "Where would you place the business today — idea, early-stage, established, or enterprise — and roughly how long has it been operating?" },
  { id: 3, text: "Where is the business primarily based? City and state is fine." },
  { id: 4, text: "Who do you primarily sell to, and what problem are they hiring you to solve?" },
  { id: 5, text: "What do you actually sell today — and why do clients choose you over alternatives?" },
  { id: 6, text: "How big is the team today, and where do you personally spend most of your time?" },
  { id: 7, text: "In plain terms — why does this business exist, and what would success look like in three years?" },
  { id: 8, text: "What are the most important goals for the next 12 months — and what's getting in the way right now?" },
  { id: 9, text: "How do you expect the business to grow — new markets, new offers, partnerships, or scale?" },
];

const SaveBadge = ({ status }) => {
  if (status === "saving") return <span className="text-[11px] text-white/40 ml-2">Saving…</span>;
  if (status === "saved") return <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 ml-2"><Check size={11} /> Saved</span>;
  return null;
};

/** Authenticated fetch helper — includes credentials + Bearer token from Supabase session */
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
  const [messages, setMessages] = useState([]);
  const [stepIndex, setStepIndex] = useState(-1);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatuses, setSaveStatuses] = useState({});
  const [inlineError, setInlineError] = useState(null);
  const [failedPayload, setFailedPayload] = useState(null);
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
    if (phase === "welcome") return "Calibration";
    if (phase === "initializing") return "Calibration · Preparing…";
    if (phase === "complete") return "Calibration · Complete";
    if (stepIndex >= 0) return `Calibration · Step ${stepIndex + 1} of ${QUESTIONS.length}`;
    return "Calibration · Getting started";
  }, [phase, stepIndex]);

  /* ── Begin Calibration (explicit, no auto-call) ── */
  const handleBegin = async () => {
    setPhase("initializing");
    setInlineError(null);
    try {
      const res = await calFetch("/api/calibration/init", { method: "POST", session });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessages([
        { role: "advisor", text: `${welcomeText}\n${BASE_INITIAL_MESSAGE}` },
        { role: "advisor", text: QUESTIONS[0].text },
      ]);
      setStepIndex(0);
      setPhase("active");
    } catch (err) {
      console.error("[calibration] Begin failed:", err);
      setPhase("welcome");
      setInlineError("Could not start calibration. Please refresh and try again.");
    }
  };

  /* ── Do This Later (calls defer, then navigates) ── */
  const handleSkip = async () => {
    try {
      const res = await calFetch("/api/calibration/defer", { method: "POST", session });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCalibrationMode('DEFERRED');
    } catch (err) {
      console.error("[calibration] Defer failed:", err);
      toast.error("Calibration was deferred locally, but server did not confirm. You can resume in Settings.");
      setCalibrationMode('DEFERRED');
    }
    navigate("/advisor");
  };

  /* Helpers */
  const appendMessage = (msg) => setMessages((prev) => [...prev, msg]);
  const setSaveStatus = (idx, status) => setSaveStatuses((prev) => ({ ...prev, [idx]: status }));

  /* ── Submit answer ── */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || phase !== "active") return;

    const trimmed = (failedPayload ? failedPayload.answer : inputValue).trim();
    if (!trimmed) return;

    setInlineError(null);
    setFailedPayload(null);
    setInputValue("");

    const currentQ = QUESTIONS[stepIndex];
    if (!currentQ) return;

    const msgIndex = messages.length;
    appendMessage({ role: "user", text: trimmed });
    setSaveStatus(msgIndex, "saving");
    setIsSubmitting(true);

    try {
      const res = await calFetch("/api/calibration/answer", {
        method: "POST",
        session,
        body: { question_id: currentQ.id, answer: trimmed },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setSaveStatus(msgIndex, "saved");

      if (data?.calibration_complete) {
        const closingText = data.advisor_response || FINAL_MESSAGE;
        appendMessage({ role: "advisor", text: closingText });
        setPhase("complete");

        // Fetch and display advisor activation sequence
        try {
          const actRes = await calFetch("/api/calibration/activation", { method: "GET", session });
          if (actRes.ok) {
            const act = await actRes.json();
            if (act.focus) appendMessage({ role: "advisor", text: act.focus });
            if (act.time_horizon) appendMessage({ role: "advisor", text: act.time_horizon });
            if (act.engagement) appendMessage({ role: "advisor", text: act.engagement });
          }
        } catch (_) { /* non-critical */ }

        setTimeout(() => navigate("/advisor"), 6000);
        return;
      }

      // Show AI conversational response if returned
      if (data?.advisor_response) {
        appendMessage({ role: "advisor", text: data.advisor_response });
      }

      const nextIndex = stepIndex + 1;
      if (QUESTIONS[nextIndex]) {
        appendMessage({ role: "advisor", text: QUESTIONS[nextIndex].text });
        setStepIndex(nextIndex);
      }
    } catch (err) {
      setSaveStatus(msgIndex, null);
      setInlineError("Could not save your response. Your answer is preserved — tap Retry.");
      setFailedPayload({ question_id: currentQ.id, answer: trimmed });
      setInputValue(trimmed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    if (!failedPayload) return;
    handleSubmit(new Event("submit"));
  };

  /* ══════════════ RENDER ══════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080c14] via-[#0f172a] to-[#162032] text-white flex flex-col">
      <header className="px-6 sm:px-8 py-4 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white">BIQC Calibration</h1>
        <span className="text-[11px] font-medium text-white/40 tracking-widest uppercase">{stepLabel}</span>
      </header>

      {/* Welcome screen — NO auto-calls */}
      {phase === "welcome" && (
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-xl w-full space-y-8 text-center">
            <div className="bg-black/40 border border-white/10 rounded-2xl px-8 py-10 text-left space-y-4">
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">{welcomeText}</p>
              <p className="text-base font-semibold text-white/90">I&apos;m BIQC — your strategic advisor.</p>
              <p className="text-sm leading-relaxed text-white/70">Before I can give you meaningful insight, I need to understand the business you&apos;re responsible for.</p>
              <p className="text-sm leading-relaxed text-white/70">This is a calibration session, not a form.</p>
              <p className="text-sm leading-relaxed text-white/70">I&apos;ll ask one question at a time.</p>
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

      {phase === "initializing" && (
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="flex items-center gap-3 text-white/60">
            <RefreshCw size={18} className="animate-spin" />
            <span className="text-sm">Preparing your calibration session…</span>
          </div>
        </main>
      )}

      {(phase === "active" || phase === "complete") && (
        <main className="flex-1 flex flex-col px-6 sm:px-8 py-6 min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-1" data-testid="calibration-message-list">
            {messages.map((message, index) => {
              const isFirstAdvisor = index === 0 && message.role === "advisor";
              if (isFirstAdvisor) {
                const lines = message.text.split("\n");
                return (
                  <div key={`msg-${index}`} className="max-w-2xl rounded-2xl px-6 py-5 bg-black/50 border border-white/10 shadow-lg" data-testid={`calibration-message-${index}`}>
                    <p className="text-lg font-bold text-white tracking-tight">{lines[0]}</p>
                    {lines[1] && <p className="text-sm font-semibold text-white/90 mt-2">{lines[1]}</p>}
                    {lines.slice(2).map((line, idx) => (
                      <p key={`intro-${idx}`} className="text-sm leading-relaxed text-white/75 mt-2">{line}</p>
                    ))}
                  </div>
                );
              }
              if (message.role === "advisor") {
                return (
                  <div key={`msg-${index}`} className="max-w-2xl rounded-2xl px-5 py-4 bg-black/50 border border-white/10 shadow-lg" data-testid={`calibration-message-${index}`}>
                    <p className="text-[15px] leading-relaxed text-white/90">{message.text}</p>
                  </div>
                );
              }
              return (
                <div key={`msg-${index}`} className="max-w-2xl rounded-2xl px-5 py-4 bg-blue-500 shadow-lg ml-auto flex items-end gap-2" data-testid={`calibration-message-${index}`}>
                  <p className="text-[15px] leading-relaxed text-white flex-1">{message.text}</p>
                  <SaveBadge status={saveStatuses[index]} />
                </div>
              );
            })}
          </div>

          {inlineError && (
            <div className="mt-3 flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-300 flex-1">{inlineError}</p>
              {failedPayload && (
                <button onClick={handleRetry} className="text-sm font-semibold text-red-300 hover:text-white underline underline-offset-2 shrink-0">Retry</button>
              )}
            </div>
          )}

          {phase === "active" && (
            <form onSubmit={handleSubmit} className="mt-4 flex gap-3 items-center" data-testid="calibration-form">
              <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Type your response" disabled={isSubmitting} className="flex-1 rounded-xl bg-white border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-blue-400" data-testid="calibration-input" />
              <button type="submit" disabled={isSubmitting || !inputValue.trim()} className="px-5 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold disabled:opacity-40 transition-colors" data-testid="calibration-submit">Send</button>
            </form>
          )}
        </main>
      )}
    </div>
  );
};

export default CalibrationAdvisor;
