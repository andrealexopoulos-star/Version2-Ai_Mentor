import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { apiClient } from "../lib/api";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const CREAM = '#FBFBF9';
const CHARCOAL = '#1E293B';
const MUTED = '#64748B';
const GOLD = '#B8860B';
const CARD_BG = '#FFFFFF';
const CARD_BORDER = '#E8E6E1';
const SERIF = "'Playfair Display', serif";

const WOW_CATEGORIES = ['Profile', 'Market', 'Product', 'Team', 'Strategy'];

const CalibrationAdvisor = () => {
  const navigate = useNavigate();
  const { user, session, loading } = useSupabaseAuth();

  // Flow: loading → welcome → analyzing → wow_summary → continuity → calibrating
  const [entry, setEntry] = useState("loading");
  const [userName, setUserName] = useState("");
  const [calStep, setCalStep] = useState(0);

  // Step 1: Website URL input
  const [websiteUrl, setWebsiteUrl] = useState("");

  // Analyzing animation
  const [analyzePhase, setAnalyzePhase] = useState(0);
  const [analyzeUrl, setAnalyzeUrl] = useState("");

  // WOW Summary from Edge Function
  const [wowSummary, setWowSummary] = useState(null);

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
  const [calMode, setCalMode] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);

  // Edited fields tracking — sparkle (AI) vs shield (user-verified)
  const [editedFields, setEditedFields] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Executive Reveal (completion transition)
  const [completing, setCompleting] = useState(false);
  const [revealPhase, setRevealPhase] = useState(0);

  // Last user response (for acknowledgment copy)
  const [lastResponse, setLastResponse] = useState("");
  const [editValue, setEditValue] = useState("");

  // Transition state
  const [transitioning, setTransitioning] = useState(false);
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

  // Analyzing phase animation
  useEffect(() => {
    if (entry !== "analyzing") return;
    const interval = setInterval(() => setAnalyzePhase(p => (p + 1) % 5), 2400);
    return () => clearInterval(interval);

  // Executive Reveal phase animation
  const REVEAL_PHASES = [
    'Assembling your Intelligence Dashboard...',
    'Calibrating for Revenue Velocity...',
    'Preparing Strategy Memos...',
    'Finalizing your Executive Brief...',
  ];
  useEffect(() => {
    if (!completing) return;
    const interval = setInterval(() => {
      setRevealPhase(p => {
        if (p >= REVEAL_PHASES.length - 1) {
          clearInterval(interval);
          // Redirect after final phase
          setTimeout(() => { window.location.href = '/advisor'; }, 1200);
          return p;
        }
        return p + 1;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, [completing]); // eslint-disable-line react-hooks/exhaustive-deps

  }, [entry]);

  const ANALYZE_PHASES = [
    `Analyzing ${analyzeUrl || 'your website'}...`,
    'Mapping your Revenue Velocity and market position...',
    'Evaluating Team Strengths and leadership cadence...',
    'Assessing Product-Market alignment...',
    'Compiling your Strategic Foundation...',
  ];

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
      if (d.status === 'COMPLETE') { window.location.href = '/advisor'; return; }
      if (d.status === 'IN_PROGRESS' && d.calibration_step > 1) {
        setCalStep(d.calibration_step);
        setEntry("continuity");
        return;
      }
      setEntry("welcome");
    } catch { setEntry("welcome"); }
  };

  /** Executive Reveal — triggered on COMPLETE */
  const triggerComplete = () => {
    setCompleting(true);
    setEntry("completing");
    setRevealPhase(0);
  };


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

  /** Step 1: Submit website URL for audit */
  const handleAuditSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !websiteUrl.trim()) return;
    const url = websiteUrl.trim();
    setAnalyzeUrl(url);
    setError(null);
    setIsSubmitting(true);
    setEntry("analyzing");

    try {
      const data = await callEdge({ step: 1, website_url: url });

      if (data.status === "COMPLETE") { triggerComplete(); return; }

      // Check if Edge returned a WOW_SUMMARY
      if (data.wow_summary || data.audit || data.summary) {
        setWowSummary(data.wow_summary || data.audit || data.summary || data);
        setEntry("wow_summary");
        return;
      }

      // If Edge returns structured question/options or message, proceed to calibrating
      applyResponse(data);
    } catch {
      setError("Calibration engine temporarily unavailable.");
      setEntry("welcome");
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Confirm WOW summary → dissolve transition → Step 2 */
  const handleConfirmWow = async () => {
    setError(null);
    setTransitioning(true);

    // Apply any user edits to the wowSummary
    if (Object.keys(editedFields).length > 0 && wowSummary && typeof wowSummary === 'object') {
      const updated = { ...wowSummary };
      for (const [key, val] of Object.entries(editedFields)) {
        if (updated[key] !== undefined) {
          updated[key] = val;
        }
      }
      setWowSummary(updated);
    }

    // Show transition copy for 2.5s
    await new Promise(r => setTimeout(r, 2500));

    setIsSubmitting(true);
    try {
      const payload = { step: 2, confirmed_summary: true };
      if (Object.keys(editedFields).length > 0) {
        payload.user_edits = editedFields;
      }
      const data = await callEdge(payload);
      if (data.status === "COMPLETE") { triggerComplete(); return; }
      setTransitioning(false);
      applyResponse(data);
    } catch {
      setTransitioning(false);
      setError("Calibration engine temporarily unavailable.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Inline edit handlers */
  const startEdit = (key, currentValue) => {
    setEditingKey(key);
    setEditValue(typeof currentValue === 'object' ? (currentValue.summary || currentValue.description || JSON.stringify(currentValue)) : String(currentValue));
  };

  const commitEdit = (key) => {
    if (editValue.trim()) {
      setEditedFields(prev => ({ ...prev, [key]: editValue.trim() }));
      if (wowSummary && typeof wowSummary === 'object') {
        setWowSummary(prev => ({ ...prev, [key]: editValue.trim() }));
      }
    }
    setEditingKey(null);
    setEditValue("");
  };

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

  const startCalibration = async () => {
    setError(null);
    setEntry("calibrating");
    try {
      const data = await callEdge({ step: calStep > 0 ? calStep : 1 });
      if (data.status === "COMPLETE") { triggerComplete(); return; }
      applyResponse(data);
    } catch { setError("Calibration engine temporarily unavailable."); }
  };

  const handleWizardContinue = async () => {
    if (isSubmitting || !selectedOption) return;
    setError(null); setIsSubmitting(true);
    setLastResponse(selectedOption);

    // Fade out current step
    setCalMode(null);

    const payload = {
      step: currentStep,
      selected: selectedOption,
      user_response: selectedOption,
    };
    if (textValue.trim()) payload.text = textValue.trim();
    if (isProbe) payload.probe = true;

    try {
      const data = await callEdge(payload);
      if (data.status === "COMPLETE") { triggerComplete(); return; }

      // Brief pause for slide transition feel
      await new Promise(r => setTimeout(r, 400));
      applyResponse(data);
    } catch { setError("Calibration engine temporarily unavailable."); }
    finally { setIsSubmitting(false); }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !inputValue.trim()) return;
    const msg = inputValue.trim();
    setInputValue(""); setError(null); setIsSubmitting(true);
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    try {
      const data = await callEdge({ message: msg });
      if (data.message) setMessages(prev => [...prev, { role: "edge", text: data.message }]);
      if (data.status === "COMPLETE") { triggerComplete(); return; }
      if (data.question && data.options?.length > 0) applyResponse(data);
    } catch { setError("Calibration engine temporarily unavailable."); setInputValue(msg); }
    finally { setIsSubmitting(false); inputRef.current?.focus(); }
  };

  const progressPercent = Math.min(Math.round((calStep / 9) * 100), 99);
  const ringRadius = 52;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (progressPercent / 100) * ringCirc;

  // Sparkle icon (AI-generated)
  const SparkleIcon = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: 'inline', verticalAlign: 'middle' }}>
      <path d="M8 0L9.8 6.2L16 8L9.8 9.8L8 16L6.2 9.8L0 8L6.2 6.2L8 0Z" fill={GOLD} />
    </svg>
  );

  // Shield icon (user-verified)
  const ShieldIcon = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: 'inline', verticalAlign: 'middle' }}>
      <path d="M8 1L2 4V7.5C2 11.1 4.5 14.4 8 15.5C11.5 14.4 14 11.1 14 7.5V4L8 1Z" fill="#2D6A4F" />
      <path d="M6.5 10.5L4.5 8.5L5.2 7.8L6.5 9.1L10.8 4.8L11.5 5.5L6.5 10.5Z" fill="white" />
    </svg>
  );

  // Render a single WOW field with inline editing
  const WowField = ({ fieldKey, label, value }) => {
    const isEditing = editingKey === fieldKey;
    const isUserEdited = editedFields[fieldKey] !== undefined;
    const displayVal = typeof value === 'object' ? (value.summary || value.description || JSON.stringify(value)) : String(value);

    return (
      <div className="rounded-xl px-5 py-4 transition-all duration-300" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-xs font-medium uppercase tracking-wider" style={{ color: GOLD, letterSpacing: '0.12em' }}>{label}</h4>
          {isUserEdited ? <ShieldIcon /> : <SparkleIcon />}
        </div>
        {isEditing ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => commitEdit(fieldKey)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(fieldKey); } }}
            className="w-full text-sm leading-relaxed focus:outline-none resize-none bg-transparent"
            style={{ color: CHARCOAL, fontFamily: 'inherit', minHeight: 60 }}
            autoFocus
            rows={3}
          />
        ) : (
          <p
            className="text-sm leading-relaxed cursor-text transition-colors hover:bg-gray-50 rounded px-1 -mx-1 py-0.5"
            style={{ color: CHARCOAL }}
            onClick={() => startEdit(fieldKey, displayVal)}
            title="Click to edit"
          >
            {displayVal}
          </p>
        )}
      </div>
    );
  };

  // Render WOW summary fields
  const renderWowFields = () => {
    if (!wowSummary) return null;
    if (typeof wowSummary === 'string') {
      return <WowField fieldKey="summary" label="Summary" value={wowSummary} />;
    }

    // Try standard categories first
    const standardFields = WOW_CATEGORIES.map(cat => {
      const key = cat.toLowerCase();
      const val = wowSummary[key] || wowSummary[cat] || wowSummary[`${key}_summary`];
      if (!val) return null;
      return <WowField key={key} fieldKey={key} label={cat} value={val} />;
    }).filter(Boolean);

    if (standardFields.length > 0) return standardFields;

    // Fallback: render all object keys
    return Object.entries(wowSummary)
      .filter(([, v]) => v && (typeof v === 'string' || typeof v === 'object'))
      .map(([key, val]) => (
        <WowField key={key} fieldKey={key} label={key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())} value={val} />
      ));
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: CREAM }} data-testid="calibration-page">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* LOADING */}
      {entry === "loading" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border rounded-full animate-spin" style={{ borderColor: CARD_BORDER, borderTopColor: CHARCOAL }} />
        </div>
      )}

      {/* ── WELCOME: The Intelligence Handshake ── */}
      {entry === "welcome" && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-lg w-full text-center">
            <h1 className="text-3xl sm:text-4xl mb-4" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 600 }}>
              {firstName ? `Welcome to BIQc, ${firstName}.` : 'Welcome to BIQc.'}
            </h1>
            <p className="text-base leading-relaxed mb-8" style={{ color: MUTED, maxWidth: 460, margin: '0 auto' }}>
              To begin our alignment, please provide your business website URL. I will perform a deep-dive audit of your market presence to build your strategic foundation.
            </p>

            {error && <p className="text-sm text-red-500 mb-4" data-testid="calibration-error">{error}</p>}

            <form onSubmit={handleAuditSubmit} className="max-w-md mx-auto space-y-4">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="www.yourcompany.com"
                className="w-full rounded-xl px-5 py-3.5 text-base text-center focus:outline-none transition-colors"
                style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: CHARCOAL }}
                autoFocus
                required
                data-testid="website-url-input"
              />
              <button
                type="submit"
                disabled={isSubmitting || !websiteUrl.trim()}
                className="w-full px-8 py-3.5 rounded-full text-sm font-medium transition-opacity disabled:opacity-40"
                style={{ background: CHARCOAL, color: '#FFFFFF' }}
                data-testid="begin-audit-btn"
              >
                Begin Audit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── ANALYZING: Executive Pulse Animation ── */}
      {entry === "analyzing" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6" data-testid="analyzing-state">
          {/* Pulsing ring */}
          <div className="mb-10" style={{ width: 100, height: 100 }}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke={CARD_BORDER} strokeWidth="3" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={GOLD} strokeWidth="3"
                strokeDasharray="264" strokeDashoffset="66"
                strokeLinecap="round" transform="rotate(-90 50 50)">
                <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="2s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>
          <p className="text-base text-center leading-relaxed transition-opacity duration-1000"
            style={{ fontFamily: SERIF, color: CHARCOAL, maxWidth: 440 }}>
            {ANALYZE_PHASES[analyzePhase]}
          </p>
          <div className="flex gap-1.5 mt-5">
            {ANALYZE_PHASES.map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                style={{ background: i === analyzePhase ? GOLD : CARD_BORDER }} />
            ))}
          </div>
        </div>
      )}

      {/* ── WOW SUMMARY: The Revelation ── */}
      {entry === "wow_summary" && wowSummary && !transitioning && (
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8" style={{ animation: 'fadeIn 0.6s ease' }}>
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl mb-3" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 600 }}>
                Your Executive Audit Brief
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: MUTED, maxWidth: 440, margin: '0 auto' }}>
                {firstName ? `${firstName}, I` : 'I'} have mapped your digital footprint to your Business DNA.
                Click any field to refine it.
              </p>
              <div className="flex items-center justify-center gap-4 mt-3">
                <span className="flex items-center gap-1 text-[11px]" style={{ color: MUTED }}>
                  <SparkleIcon /> AI-generated
                </span>
                <span className="flex items-center gap-1 text-[11px]" style={{ color: MUTED }}>
                  <ShieldIcon /> Verified by you
                </span>
              </div>
            </div>

            <div className="space-y-4" data-testid="wow-categories">
              {renderWowFields()}
            </div>

            <div className="text-center pt-6">
              <p className="text-sm mb-6" style={{ color: MUTED }}>
                Is this the foundation we should use for your intelligence memos?
              </p>
              {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
              <button
                onClick={handleConfirmWow}
                disabled={isSubmitting}
                className="px-8 py-3.5 rounded-full text-sm font-medium transition-opacity disabled:opacity-40"
                style={{ background: CHARCOAL, color: '#FFFFFF' }}
                data-testid="confirm-wow-btn"
              >
                Confirm & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DISSOLVE TRANSITION ── */}
      {transitioning && (
        <div className="flex-1 flex items-center justify-center px-6" style={{ animation: 'fadeIn 0.8s ease' }}>
          <div className="max-w-md text-center">
            <p className="text-lg leading-relaxed" style={{ fontFamily: SERIF, color: CHARCOAL }}>
              Thank you, {firstName || 'there'}. With your foundation verified, I now need to understand how you navigate high-stakes decisions.
            </p>
            <div className="mt-6">
              <div className="w-5 h-5 border rounded-full animate-spin mx-auto" style={{ borderColor: CARD_BORDER, borderTopColor: GOLD }} />
            </div>
          </div>
        </div>
      )}

      {/* ── EXECUTIVE REVEAL (Completion Transition) ── */}
      {entry === "completing" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ animation: 'fadeIn 0.8s ease' }} data-testid="executive-reveal">
          {/* Acknowledgment */}
          <div className="max-w-md text-center mb-10">
            <p className="text-lg leading-relaxed mb-2" style={{ fontFamily: SERIF, color: CHARCOAL }}>
              Thank you{firstName ? `, ${firstName}` : ''}. Your alignment is complete.
            </p>
            {lastResponse && (
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                Your approach to {lastResponse.toLowerCase().replace(/ — .*/, '')} has been integrated into your Decision DNA.
              </p>
            )}
          </div>

          {/* Executive Pulse */}
          <div className="mb-8" style={{ width: 80, height: 80 }}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke={CARD_BORDER} strokeWidth="3" />
              <circle cx="40" cy="40" r="34" fill="none" stroke={GOLD} strokeWidth="3"
                strokeDasharray="214" strokeDashoffset={214 - (214 * ((revealPhase + 1) / REVEAL_PHASES.length))}
                strokeLinecap="round" transform="rotate(-90 40 40)"
                style={{ transition: 'stroke-dashoffset 1.5s ease' }} />
            </svg>
          </div>

          <p className="text-base text-center leading-relaxed transition-opacity duration-700"
            style={{ fontFamily: SERIF, color: CHARCOAL, maxWidth: 400 }}>
            {REVEAL_PHASES[revealPhase]}
          </p>

          <div className="flex gap-1.5 mt-5">
            {REVEAL_PHASES.map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors duration-500"
                style={{ background: i <= revealPhase ? GOLD : CARD_BORDER }} />
            ))}
          </div>
        </div>
      )}

      {/* ── CONTINUITY SUITE (Partial User) ── */}
      {entry === "continuity" && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-lg w-full text-center">
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
              I have begun mapping your DNA, but we need the final {9 - calStep} stage{9 - calStep !== 1 ? 's' : ''} to reach 100% foresight accuracy.
            </p>
            <p className="text-sm mb-10" style={{ color: '#94A3B8' }}>{calStep} of 9 stages completed.</p>
            {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
            <button onClick={startCalibration} className="px-8 py-3 rounded-full text-sm font-medium"
              style={{ background: CHARCOAL, color: '#FFFFFF' }} data-testid="continue-calibration-btn">
              Resume My Session
            </button>
          </div>
        </div>
      )}

      {/* ── CALIBRATING (Active Session) ── */}
      {entry === "calibrating" && (
        <>
          <header className="px-6 sm:px-8 py-4" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
            <h1 className="text-sm font-medium tracking-wide uppercase" style={{ color: MUTED, letterSpacing: '0.12em' }}>
              Calibration
            </h1>
          </header>

          {!calMode && !error && (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 border rounded-full animate-spin" style={{ borderColor: CARD_BORDER, borderTopColor: CHARCOAL }} />
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center px-4">
              <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>
            </div>
          )}

          {/* Wizard Mode — Gilded Alignment Cards */}
          {calMode === "wizard" && !error && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8" style={{ animation: 'fadeIn 0.5s ease' }}>
              <div className="w-full max-w-2xl mx-auto space-y-8">
                {/* Insight (context from previous answer) */}
                {insight && (
                  <div className="text-center" style={{ animation: 'fadeIn 0.6s ease' }}>
                    <p className="text-sm leading-relaxed" style={{ color: MUTED, maxWidth: 480, margin: '0 auto' }}>{insight}</p>
                  </div>
                )}

                {/* Question — centered Playfair Display */}
                {question && (
                  <div className="text-center" style={{ animation: 'fadeIn 0.7s ease' }}>
                    <p className="text-xl sm:text-2xl leading-relaxed" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 500, maxWidth: 560, margin: '0 auto' }}
                      data-testid="calibration-question">
                      {question}
                    </p>
                  </div>
                )}

                {/* Selection Cards */}
                {options.length > 0 && (
                  <div className={`${options.length === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-3'}`}
                    style={{ animation: 'fadeIn 0.8s ease' }} data-testid="calibration-options">
                    {options.map((opt, i) => {
                      const isSelected = selectedOption === opt;
                      const optParts = typeof opt === 'string' ? opt.split(' — ') : [opt];
                      const title = optParts[0];
                      const subtitle = optParts.length > 1 ? optParts[1] : null;

                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedOption(opt)}
                          disabled={isSubmitting}
                          className="w-full text-left rounded-xl px-6 py-5 transition-all duration-200"
                          style={{
                            background: isSelected ? '#FFFCF5' : CARD_BG,
                            border: `2px solid ${isSelected ? GOLD : CARD_BORDER}`,
                            boxShadow: isSelected ? `0 0 0 1px ${GOLD}40` : 'none',
                          }}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = `${GOLD}80`; }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = CARD_BORDER; }}
                          data-testid={`calibration-option-${i}`}
                        >
                          <p className="text-sm font-semibold" style={{ color: CHARCOAL }}>{title}</p>
                          {subtitle && <p className="text-xs mt-1 leading-relaxed" style={{ color: MUTED }}>{subtitle}</p>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Optional text field */}
                {allowText && (
                  <div style={{ animation: 'fadeIn 0.9s ease' }}>
                    <textarea value={textValue} onChange={(e) => setTextValue(e.target.value)} disabled={isSubmitting} rows={3}
                      className="w-full rounded-xl px-5 py-4 text-sm focus:outline-none resize-none"
                      style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: CHARCOAL }}
                      data-testid="calibration-textarea" />
                  </div>
                )}

                {/* Continue */}
                <div className="text-center pt-2">
                  <button onClick={handleWizardContinue} disabled={isSubmitting || !selectedOption}
                    className="px-10 py-3.5 rounded-full text-sm font-medium transition-opacity disabled:opacity-30"
                    style={{ background: CHARCOAL, color: '#FFFFFF' }}
                    data-testid="calibration-continue-btn">
                    {isSubmitting ? 'Processing...' : 'Continue'}
                  </button>
                </div>
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
                      style={{ background: msg.role === "user" ? '#F0F4FF' : CARD_BG, border: `1px solid ${msg.role === "user" ? '#BFDBFE' : CARD_BORDER}`, color: CHARCOAL }}>
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
                    style={{ background: CHARCOAL, color: '#FFFFFF' }} data-testid="calibration-send-btn">
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
