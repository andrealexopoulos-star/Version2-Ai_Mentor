import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { apiClient } from "../lib/api";
import {
  CalibrationLoading, WelcomeHandshake, ManualSummaryFallback,
  AuditProgress, IdentityBar,
} from "../components/calibration/CalibrationComponents";
import { WowSummary, DissolveTransition } from "../components/calibration/WowSummary";
import { ExecutiveReveal, REVEAL_PHASES } from "../components/calibration/ExecutiveReveal";
import { ContinuitySuite } from "../components/calibration/ContinuitySuite";
import { CalibratingSession } from "../components/calibration/CalibratingSession";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const CREAM = '#FBFBF9';
const CHARCOAL = '#1E293B';
const MUTED = '#64748B';
const CARD_BORDER = '#E8E6E1';

const CalibrationAdvisor = () => {
  const navigate = useNavigate();
  const { user, session, loading, signOut } = useSupabaseAuth();

  const handleSignOut = async () => {
    try { await signOut(); localStorage.clear(); sessionStorage.clear(); window.location.href = '/login-supabase'; }
    catch { window.location.href = '/login-supabase'; }
  };

  // Flow: loading → welcome → analyzing → wow_summary → continuity → calibrating
  const [entry, setEntry] = useState("loading");
  const [userName, setUserName] = useState("");
  const [calStep, setCalStep] = useState(0);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [wowSummary, setWowSummary] = useState(null);

  // Calibration state
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

  // Editing state
  const [editedFields, setEditedFields] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [editValue, setEditValue] = useState("");

  // Transitions
  const [completing, setCompleting] = useState(false);
  const [revealPhase, setRevealPhase] = useState(0);
  const [lastResponse, setLastResponse] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const initCalled = useRef(false);

  const extractFirstName = (raw) => {
    if (!raw) return '';
    if (raw.includes('@')) {
      const namePart = raw.split('@')[0].split(/[._-]/)[0];
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
    return raw.split(' ')[0];
  };

  const firstName = extractFirstName(
    userName || user?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || ''
  );

  useEffect(() => { if (!loading && !user) navigate("/login-supabase"); }, [loading, user, navigate]);

  // Executive Reveal timer
  useEffect(() => {
    if (!completing) return;
    const interval = setInterval(() => {
      setRevealPhase(p => {
        if (p >= REVEAL_PHASES.length - 1) {
          clearInterval(interval);
          setTimeout(() => { window.location.href = '/advisor'; }, 1200);
          return p;
        }
        return p + 1;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, [completing]);

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

  const triggerComplete = () => { setCompleting(true); setEntry("completing"); setRevealPhase(0); };

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

  const handleAuditSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !websiteUrl.trim()) return;
    let url = websiteUrl.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
    setError(null);
    setIsSubmitting(true);
    setEntry("analyzing");
    try {
      try { await apiClient.put('/business-profile', { website: url }); } catch { /* non-blocking */ }
      let data;
      try { data = await callEdge({ step: 1, website_url: url }); }
      catch { try { data = await callEdge({ step: 1 }); }
      catch { try { data = await callEdge({ message: url }); }
      catch { setEntry("manual_summary"); setIsSubmitting(false); return; } } }
      if (data.status === "COMPLETE") { triggerComplete(); return; }
      if (data.wow_summary || data.audit || data.summary) {
        setWowSummary(data.wow_summary || data.audit || data.summary || data);
        setEntry("wow_summary"); return;
      }
      applyResponse(data);
    } catch { setEntry("manual_summary"); }
    finally { setIsSubmitting(false); }
  };

  const handleManualSummary = async (summary) => {
    setIsSubmitting(true); setEntry("analyzing");
    try {
      await apiClient.put('/business-profile', { mission_statement: summary });
      let data;
      try { data = await callEdge({ step: 1, message: summary }); }
      catch { try { data = await callEdge({ message: summary }); }
      catch { setEntry("calibrating"); setIsSubmitting(false); return; } }
      if (data.status === "COMPLETE") { triggerComplete(); return; }
      applyResponse(data);
    } catch { setEntry("calibrating"); }
    finally { setIsSubmitting(false); }
  };

  const handleConfirmWow = async () => {
    setError(null); setTransitioning(true);
    if (Object.keys(editedFields).length > 0 && wowSummary && typeof wowSummary === 'object') {
      const updated = { ...wowSummary };
      for (const [key, val] of Object.entries(editedFields)) {
        if (updated[key] !== undefined) updated[key] = val;
      }
      setWowSummary(updated);
    }
    await new Promise(r => setTimeout(r, 2500));
    setIsSubmitting(true);
    try {
      const payload = { step: 2, confirmed_summary: true };
      if (Object.keys(editedFields).length > 0) payload.user_edits = editedFields;
      const data = await callEdge(payload);
      if (data.status === "COMPLETE") { triggerComplete(); return; }
      setTransitioning(false);
      applyResponse(data);
    } catch { setTransitioning(false); setError("Calibration engine temporarily unavailable."); }
    finally { setIsSubmitting(false); }
  };

  const startEdit = (key, currentValue) => {
    setEditingKey(key);
    setEditValue(typeof currentValue === 'object' ? (currentValue.summary || currentValue.description || JSON.stringify(currentValue)) : String(currentValue));
  };
  const commitEdit = (key) => {
    if (editValue.trim()) {
      setEditedFields(prev => ({ ...prev, [key]: editValue.trim() }));
      if (wowSummary && typeof wowSummary === 'object') setWowSummary(prev => ({ ...prev, [key]: editValue.trim() }));
    }
    setEditingKey(null); setEditValue("");
  };

  const applyResponse = (data) => {
    if (data.question && data.options && data.options.length > 0) {
      setQuestion(data.question); setOptions(data.options); setAllowText(data.allow_text === true);
      setInsight(data.insight || null); setIsProbe(data.probe === true);
      setSelectedOption(null); setTextValue("");
      if (!data.probe) setCurrentStep(prev => data.step || prev + 1);
      setCalMode("wizard"); setEntry("calibrating"); return;
    }
    if (data.message) { setMessages(prev => [...prev, { role: "edge", text: data.message }]); setCalMode("chat"); setEntry("calibrating"); return; }
    const fb = data.text || data.response || JSON.stringify(data);
    if (fb) { setMessages(prev => [...prev, { role: "edge", text: fb }]); setCalMode("chat"); setEntry("calibrating"); }
  };

  const startCalibration = async () => {
    setError(null); setEntry("calibrating");
    try {
      const data = await callEdge({ step: calStep > 0 ? calStep : 1 });
      if (data.status === "COMPLETE") { triggerComplete(); return; }
      applyResponse(data);
    } catch { setError("Calibration engine temporarily unavailable."); }
  };

  const handleWizardContinue = async () => {
    if (isSubmitting || !selectedOption) return;
    setError(null); setIsSubmitting(true); setLastResponse(selectedOption); setCalMode(null);
    const payload = { step: currentStep, selected: selectedOption, user_response: selectedOption };
    if (textValue.trim()) payload.text = textValue.trim();
    if (isProbe) payload.probe = true;
    try {
      const data = await callEdge(payload);
      if (data.status === "COMPLETE") { triggerComplete(); return; }
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
    finally { setIsSubmitting(false); }
  };

  const userEmail = user?.email || session?.user?.email || '';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: CREAM }} data-testid="calibration-page">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {entry !== "loading" && user && (
        <div className="flex items-center justify-between px-5 py-2.5" style={{ borderBottom: `1px solid ${CARD_BORDER}` }} data-testid="identity-bar">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
            <span className="text-xs" style={{ color: MUTED }}>
              Signed in as <span style={{ color: CHARCOAL }}>{userEmail}</span>
            </span>
          </div>
          <button onClick={handleSignOut} className="text-xs px-3 py-1 rounded-full transition-colors"
            style={{ color: MUTED, border: `1px solid ${CARD_BORDER}` }} data-testid="sign-out-btn">Sign out</button>
        </div>
      )}

      {entry === "loading" && <CalibrationLoading />}

      {entry === "welcome" && (
        <WelcomeHandshake firstName={firstName} websiteUrl={websiteUrl} setWebsiteUrl={setWebsiteUrl}
          onSubmit={handleAuditSubmit} onManualFallback={() => setEntry("manual_summary")}
          isSubmitting={isSubmitting} error={error} />
      )}

      {entry === "manual_summary" && (
        <ManualSummaryFallback firstName={firstName} onSubmit={handleManualSummary} isSubmitting={isSubmitting} />
      )}

      {entry === "analyzing" && <AuditProgress />}

      {entry === "wow_summary" && wowSummary && !transitioning && (
        <WowSummary firstName={firstName} wowSummary={wowSummary} editedFields={editedFields}
          editingKey={editingKey} editValue={editValue} setEditValue={setEditValue}
          startEdit={startEdit} commitEdit={commitEdit}
          handleConfirmWow={handleConfirmWow} isSubmitting={isSubmitting} error={error} />
      )}

      {transitioning && <DissolveTransition firstName={firstName} />}

      {entry === "completing" && (
        <ExecutiveReveal firstName={firstName} lastResponse={lastResponse} revealPhase={revealPhase} />
      )}

      {entry === "continuity" && (
        <ContinuitySuite firstName={firstName} calStep={calStep} error={error} onResume={startCalibration} />
      )}

      {entry === "calibrating" && (
        <CalibratingSession calMode={calMode} error={error} question={question} options={options}
          allowText={allowText} insight={insight} selectedOption={selectedOption}
          setSelectedOption={setSelectedOption} textValue={textValue} setTextValue={setTextValue}
          isSubmitting={isSubmitting} handleWizardContinue={handleWizardContinue}
          messages={messages} inputValue={inputValue} setInputValue={setInputValue}
          handleChatSubmit={handleChatSubmit} />
      )}
    </div>
  );
};

export default CalibrationAdvisor;
