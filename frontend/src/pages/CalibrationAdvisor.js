import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { apiClient } from "../lib/api";
import { Check, AlertCircle, RefreshCw } from "lucide-react";

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

/* ─── Save‑status badge (inline, per‑message) ─── */
const SaveBadge = ({ status }) => {
  if (status === "saving") return <span className="text-[11px] text-white/40 ml-2">Saving…</span>;
  if (status === "saved") return <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 ml-2"><Check size={11} /> Saved</span>;
  return null;
};

const CalibrationAdvisor = () => {
  const navigate = useNavigate();
  const { user, loading } = useSupabaseAuth();

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
    // If name looks like an email, extract the part before @
    let firstName = null;
    if (fullName) {
      if (fullName.includes("@")) {
        firstName = fullName.split("@")[0];
      } else {
        firstName = fullName.split(" ")[0];
      }
    }
    return firstName ? `Welcome, ${firstName}.` : "Welcome.";
  }, [user]);

  /* ─── Auth guard ─── */
  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  /* ─── Auto‑scroll ─── */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, phase]);

  /* ─── Step label ─── */
  const stepLabel = useMemo(() => {
    if (phase === "welcome") return "Calibration";
    if (phase === "initializing") return "Calibration · Preparing…";
    if (phase === "complete") return "Calibration · Complete";
    if (stepIndex >= 0) return `Calibration · Step ${stepIndex + 1} of ${QUESTIONS.length}`;
    return "Calibration · Getting started";
  }, [phase, stepIndex]);

  /* ─── Begin Calibration ─── */
  const handleBegin = async () => {
    setPhase("initializing");
    try {
      await apiClient.post("/api/calibration/init");
    } catch (err) {
      console.warn("[calibration] init call failed, continuing anyway:", err);
    }
    // Show intro message + Q1
    setMessages([
      { role: "advisor", text: `${welcomeText}\n${BASE_INITIAL_MESSAGE}` },
      { role: "advisor", text: QUESTIONS[0].text },
    ]);
    setStepIndex(0);
    setPhase("active");
  };

  /* ─── Do This Later ─── */
  const handleSkip = () => {
    localStorage.setItem("biqc_show_tutorial", "true");
    localStorage.setItem("biqc_calibration_skipped", "true");
    navigate("/advisor");
  };

  /* ─── Helpers ─── */
  const appendMessage = (msg) => setMessages((prev) => [...prev, msg]);
  const setSaveStatus = (idx, status) => setSaveStatuses((prev) => ({ ...prev, [idx]: status }));

  /* ─── Submit answer ─── */
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

    // Optimistic: show user message immediately
    const msgIndex = messages.length;
    appendMessage({ role: "user", text: trimmed });
    setSaveStatus(msgIndex, "saving");
    setIsSubmitting(true);

    try {
      const response = await apiClient.post("/api/calibration/answer", {
        question_id: currentQ.id,
        answer: trimmed,
      });

      setSaveStatus(msgIndex, "saved");

      if (response.data?.calibration_complete) {
        appendMessage({ role: "advisor", text: FINAL_MESSAGE });
        setPhase("complete");

        try {
          const profileResponse = await apiClient.get("/api/auth/check-profile");
          if (profileResponse.data?.user) {
            localStorage.setItem("biqc_context_v1", JSON.stringify({
              user_id: profileResponse.data.user.id,
              account_id: profileResponse.data.user.account_id,
              business_profile_id: profileResponse.data.user.business_profile_id,
              onboarding_status: profileResponse.data.onboarding_status,
              calibration_status: profileResponse.data.calibration_status,
              cached_at: Date.now(),
            }));
          }
        } catch (_) { /* non‑critical */ }

        setTimeout(() => navigate("/advisor"), 2500);
        return;
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

  /* ─── Retry failed answer ─── */
  const handleRetry = () => {
    if (!failedPayload) return;
    handleSubmit(new Event("submit"));
  };

  /* ════════════════════════════════════════
     RENDER
     ════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080c14] via-[#0f172a] to-[#162032] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="px-6 sm:px-8 py-4 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white">BIQC Calibration</h1>
        <span className="text-[11px] font-medium text-white/40 tracking-widest uppercase">{stepLabel}</span>
      </header>

      {/* ── Welcome screen ── */}
      {phase === "welcome" && (
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-xl w-full space-y-8 text-center">
            {/* Welcome card */}
            <div className="bg-black/40 border border-white/10 rounded-2xl px-8 py-10 text-left space-y-4">
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">{welcomeText}</p>
              <p className="text-base font-semibold text-white/90">I&apos;m BIQC — your strategic advisor.</p>
              <p className="text-sm leading-relaxed text-white/70">
                Before I can give you meaningful insight, I need to understand the business you&apos;re responsible for.
              </p>
              <p className="text-sm leading-relaxed text-white/70">This is a calibration session, not a form.</p>
              <p className="text-sm leading-relaxed text-white/70">I&apos;ll ask one question at a time.</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleBegin}
                className="px-8 py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-base font-semibold transition-colors shadow-lg shadow-blue-500/20"
                data-testid="calibration-begin"
              >
                Begin Calibration
              </button>
              <button
                onClick={handleSkip}
                className="px-8 py-3.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/15 text-white/70 hover:text-white text-base font-medium transition-colors"
                data-testid="calibration-skip"
              >
                Do This Later
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ── Initializing ── */}
      {phase === "initializing" && (
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="flex items-center gap-3 text-white/60">
            <RefreshCw size={18} className="animate-spin" />
            <span className="text-sm">Preparing your calibration session…</span>
          </div>
        </main>
      )}

      {/* ── Active chat / Complete ── */}
      {(phase === "active" || phase === "complete") && (
        <main className="flex-1 flex flex-col px-6 sm:px-8 py-6 min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-1" data-testid="calibration-message-list">
            {messages.map((message, index) => {
              const isFirstAdvisor = index === 0 && message.role === "advisor";

              /* ── Welcome intro card ── */
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

              /* ── Advisor question bubble ── */
              if (message.role === "advisor") {
                return (
                  <div key={`msg-${index}`} className="max-w-2xl rounded-2xl px-5 py-4 bg-black/50 border border-white/10 shadow-lg" data-testid={`calibration-message-${index}`}>
                    <p className="text-[15px] leading-relaxed text-white/90">{message.text}</p>
                  </div>
                );
              }

              /* ── User answer bubble ── */
              return (
                <div key={`msg-${index}`} className="max-w-2xl rounded-2xl px-5 py-4 bg-blue-500 shadow-lg ml-auto flex items-end gap-2" data-testid={`calibration-message-${index}`}>
                  <p className="text-[15px] leading-relaxed text-white flex-1">{message.text}</p>
                  <SaveBadge status={saveStatuses[index]} />
                </div>
              );
            })}
          </div>

          {/* ── Inline error + retry ── */}
          {inlineError && (
            <div className="mt-3 flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-300 flex-1">{inlineError}</p>
              {failedPayload && (
                <button onClick={handleRetry} className="text-sm font-semibold text-red-300 hover:text-white underline underline-offset-2 shrink-0">
                  Retry
                </button>
              )}
            </div>
          )}

          {/* ── Input bar ── */}
          {phase === "active" && (
            <form onSubmit={handleSubmit} className="mt-4 flex gap-3 items-center" data-testid="calibration-form">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your response"
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-white/8 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-400/60"
                data-testid="calibration-input"
              />
              <button
                type="submit"
                disabled={isSubmitting || !inputValue.trim()}
                className="px-5 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold disabled:opacity-40 transition-colors"
                data-testid="calibration-submit"
              >
                Send
              </button>
            </form>
          )}
        </main>
      )}
    </div>
  );
};

export default CalibrationAdvisor;
