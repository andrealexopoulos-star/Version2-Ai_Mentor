import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { apiClient } from "../lib/api";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const CalibrationAdvisor = () => {
  const navigate = useNavigate();
  const { user, session, loading } = useSupabaseAuth();

  const [phase, setPhase] = useState("idle"); // idle | active
  const [currentStep, setCurrentStep] = useState(1);
  const [question, setQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [allowText, setAllowText] = useState(false);
  const [insight, setInsight] = useState(null);
  const [isProbe, setIsProbe] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [textValue, setTextValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const initCalled = useRef(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) navigate("/login-supabase");
  }, [loading, user, navigate]);

  // On mount: check if already complete → redirect. Otherwise, send { step: 1 }.
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
          applyEdgeResponse(data, 1);
          setPhase("active");
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

  /** Apply Edge response fields to state */
  const applyEdgeResponse = (data, step) => {
    setQuestion(data.question || null);
    setOptions(data.options || []);
    setAllowText(data.allow_text === true);
    setInsight(data.insight || null);
    setIsProbe(data.probe === true);
    setSelectedOption(null);
    setTextValue("");
    if (!data.probe) {
      setCurrentStep(step);
    }
  };

  /** Continue: send selection to Edge Function */
  const handleContinue = async () => {
    if (isSubmitting || !selectedOption) return;

    setError(null);
    setIsSubmitting(true);

    const payload = {
      step: currentStep,
      selected: selectedOption,
    };
    if (textValue.trim()) {
      payload.text = textValue.trim();
    }
    if (isProbe) {
      payload.probe = true;
    }

    try {
      const data = await callEdge(payload);

      if (data.status === "COMPLETE") {
        window.location.href = "/advisor";
        return;
      }

      const nextStep = data.probe ? currentStep : currentStep + 1;
      applyEdgeResponse(data, nextStep);
    } catch {
      setError("Calibration engine temporarily unavailable.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-white flex flex-col" data-testid="calibration-page">
      <header className="px-6 sm:px-8 py-4 border-b border-white/10">
        <h1 className="text-base font-semibold tracking-tight text-white/80 font-mono" data-testid="calibration-header">
          CALIBRATION
        </h1>
      </header>

      <main className="flex-1 flex items-start justify-center overflow-y-auto px-4 sm:px-8 py-8">
        <div className="w-full max-w-2xl space-y-6">

          {/* Loading — waiting for Edge */}
          {phase === "idle" && !error && (
            <div className="flex justify-center py-16" data-testid="calibration-loading">
              <div className="w-5 h-5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="py-16 text-center" data-testid="calibration-error">
              <p className="text-sm text-red-400/80">{error}</p>
            </div>
          )}

          {/* Active — render Edge response */}
          {phase === "active" && !error && (
            <>
              {/* Insight (if provided) */}
              {insight && (
                <div className="bg-white/5 border border-white/8 rounded-lg px-5 py-4" data-testid="calibration-insight">
                  <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{insight}</p>
                </div>
              )}

              {/* Question */}
              {question && (
                <div data-testid="calibration-question">
                  <p className="text-base text-white/90 leading-relaxed whitespace-pre-wrap">{question}</p>
                </div>
              )}

              {/* Options (buttons) */}
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
                          : "bg-white/5 border border-white/8 text-white/70 hover:bg-white/10 hover:text-white/90"
                      }`}
                      data-testid={`calibration-option-${i}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Optional text field (if allow_text) */}
              {allowText && (
                <div data-testid="calibration-text-field">
                  <textarea
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    disabled={isSubmitting}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 resize-none"
                    data-testid="calibration-textarea"
                  />
                </div>
              )}

              {/* Continue button */}
              <button
                onClick={handleContinue}
                disabled={isSubmitting || !selectedOption}
                className="px-8 py-3 bg-white/10 hover:bg-white/15 disabled:opacity-20 rounded-lg text-sm font-medium text-white transition-colors"
                data-testid="calibration-continue-btn"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border border-white/20 border-t-white/50 rounded-full animate-spin mx-auto" />
                ) : (
                  "Continue"
                )}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default CalibrationAdvisor;
