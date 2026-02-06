import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { apiClient } from "../lib/api";

const BASE_INITIAL_MESSAGE =
  "I’m BIQC — your strategic advisor.\nBefore I can give you meaningful insight, I need to understand the business you’re responsible for.\nThis is a calibration session, not a form.\nI’ll ask one question at a time.";

const FINAL_MESSAGE =
  "Calibration complete.\nI now understand the business you’re responsible for.\nBIQC is ready to advise you.";

const QUESTIONS = [
  {
    id: 1,
    text: "What’s the name of the business you’re operating, and what industry does it sit in?",
  },
  {
    id: 2,
    text: "Where would you place the business today — idea, early-stage, established, or enterprise — and roughly how long has it been operating?",
  },
  {
    id: 3,
    text: "Where is the business primarily based? City and state is fine.",
  },
  {
    id: 4,
    text: "Who do you primarily sell to, and what problem are they hiring you to solve?",
  },
  {
    id: 5,
    text: "What do you actually sell today — and why do clients choose you over alternatives?",
  },
  {
    id: 6,
    text: "How big is the team today, and where do you personally spend most of your time?",
  },
  {
    id: 7,
    text: "In plain terms — why does this business exist, and what would success look like in three years?",
  },
  {
    id: 8,
    text: "What are the most important goals for the next 12 months — and what’s getting in the way right now?",
  },
  {
    id: 9,
    text: "How do you expect the business to grow — new markets, new offers, partnerships, or scale?",
  },
];

const CalibrationAdvisor = () => {
  const navigate = useNavigate();
  const { user, loading } = useSupabaseAuth();
  const [messages, setMessages] = useState([]);
  const [stepIndex, setStepIndex] = useState(-1);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [calibrationComplete, setCalibrationComplete] = useState(false);
  const scrollRef = useRef(null);

  const currentQuestion = useMemo(() => {
    if (stepIndex < 0) return null;
    return QUESTIONS[stepIndex] || null;
  }, [stepIndex]);

  const initialMessage = useMemo(() => {
    const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name;
    const firstName = fullName ? fullName.split(" ")[0] : null;
    const welcomeLine = firstName ? `Welcome, ${firstName}.` : "Welcome.";
    return `${welcomeLine}\n${BASE_INITIAL_MESSAGE}`;
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (messages.length === 0 && initialMessage) {
      setMessages([{ role: "advisor", text: initialMessage }]);
    }
  }, [initialMessage, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const appendMessage = (message) => {
    setMessages((prev) => [...prev, message]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || !inputValue.trim()) return;

    setError(null);
    const trimmed = inputValue.trim();
    setInputValue("");

    if (stepIndex === -1) {
      appendMessage({ role: "user", text: trimmed });
      appendMessage({ role: "advisor", text: QUESTIONS[0].text });
      setStepIndex(0);
      return;
    }

    if (!currentQuestion) return;

    appendMessage({ role: "user", text: trimmed });
    setIsSubmitting(true);

    try {
      const response = await apiClient.post("/api/calibration/answer", {
        question_id: currentQuestion.id,
        answer: trimmed,
      });

      if (response.data?.calibration_complete) {
        appendMessage({ role: "advisor", text: FINAL_MESSAGE });
        setCalibrationComplete(true);

        const profileResponse = await apiClient.get("/api/auth/check-profile");
        if (profileResponse.data?.user) {
          const contextPayload = {
            user_id: profileResponse.data.user.id,
            account_id: profileResponse.data.user.account_id,
            business_profile_id: profileResponse.data.user.business_profile_id,
            onboarding_status: profileResponse.data.onboarding_status,
            calibration_status: profileResponse.data.calibration_status,
            cached_at: Date.now(),
          };
          localStorage.setItem("biqc_context_v1", JSON.stringify(contextPayload));
        }

        setTimeout(() => {
          navigate("/advisor");
        }, 2000);
        return;
      }

      const nextIndex = stepIndex + 1;
      if (QUESTIONS[nextIndex]) {
        appendMessage({ role: "advisor", text: QUESTIONS[nextIndex].text });
        setStepIndex(nextIndex);
      }
    } catch (err) {
      setError("Calibration response could not be saved. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derive step label for the header indicator
  const stepLabel = useMemo(() => {
    if (calibrationComplete) return "Calibration · Complete";
    if (stepIndex < 0) return "Calibration · Getting started";
    return `Calibration · Step ${stepIndex + 1} of ${QUESTIONS.length}`;
  }, [stepIndex, calibrationComplete]);

  // Check if a message is the initial welcome message (first advisor message)
  const isInitialMessage = (message, index) =>
    index === 0 && message.role === "advisor";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1a] via-[#0f172a] to-[#1a2332] text-white flex flex-col">
      <header className="px-6 sm:px-8 py-5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight" data-testid="calibration-title">
            BIQC Calibration
          </h1>
          <span className="text-xs font-medium text-white/50 tracking-wide uppercase" data-testid="calibration-step">
            {stepLabel}
          </span>
        </div>
        <p className="text-sm text-white/50 mt-1" data-testid="calibration-subtitle">
          One question at a time. Your answers shape the advisory context.
        </p>
      </header>

      <main className="flex-1 flex flex-col px-6 sm:px-8 py-6">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-4 pr-2"
          data-testid="calibration-message-list"
        >
          {messages.map((message, index) => {
            if (isInitialMessage(message, index)) {
              const lines = message.text.split("\n");
              return (
                <div
                  key={`${message.role}-${index}`}
                  className="max-w-2xl rounded-2xl px-6 py-6 shadow-lg bg-black/50 border border-white/10"
                  data-testid={`calibration-message-${index}`}
                >
                  {/* Welcome line — dominant */}
                  <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {lines[0]}
                  </p>
                  {/* "I'm BIQC" line — strong secondary */}
                  {lines[1] && (
                    <p className="text-base sm:text-lg font-semibold text-white/90 mt-3">
                      {lines[1]}
                    </p>
                  )}
                  {/* Remaining lines — clear body text with spacing */}
                  {lines.slice(2).map((line, idx) => (
                    <p
                      key={`${index}-body-${idx}`}
                      className="text-sm sm:text-base leading-relaxed text-white/80 mt-3"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              );
            }

            return (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-2xl rounded-2xl px-5 py-4 text-sm sm:text-base leading-relaxed shadow-lg ${
                  message.role === "advisor"
                    ? "bg-black/50 border border-white/10 text-white/90"
                    : "bg-blue-500 text-white ml-auto"
                }`}
                data-testid={`calibration-message-${index}`}
              >
                {message.text.split("\n").map((line, idx) => (
                  <p key={`${index}-${idx}`}>{line}</p>
                ))}
              </div>
            );
          })}
        </div>

        {error && (
          <div
            className="mt-4 text-sm text-red-300"
            data-testid="calibration-error"
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-6 flex gap-3 items-center"
          data-testid="calibration-form"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={
              stepIndex === -1
                ? "Type to begin"
                : "Type your response"
            }
            disabled={isSubmitting || calibrationComplete}
            className="flex-1 rounded-xl bg-white/8 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-blue-400/40"
            data-testid="calibration-input"
          />
          <button
            type="submit"
            disabled={isSubmitting || calibrationComplete}
            className="px-5 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
            data-testid="calibration-submit"
          >
            {stepIndex === -1 ? "Continue" : "Send"}
          </button>
        </form>
      </main>
    </div>
  );
};

export default CalibrationAdvisor;