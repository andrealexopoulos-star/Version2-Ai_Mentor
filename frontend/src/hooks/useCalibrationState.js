import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { apiClient } from "../lib/api";
import { REVEAL_PHASES } from "../components/calibration/ExecutiveReveal";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const extractFirstName = (raw) => {
  if (!raw) return '';
  if (raw.includes('@')) {
    const namePart = raw.split('@')[0].split(/[._-]/)[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  }
  return raw.split(' ')[0];
};

export const useCalibrationState = () => {
  const navigate = useNavigate();
  const { user, session, loading, signOut } = useSupabaseAuth();

  const [entry, setEntry] = useState("loading");
  const [userName, setUserName] = useState("");
  const [calStep, setCalStep] = useState(0);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [wowSummary, setWowSummary] = useState(null);

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

  const [editedFields, setEditedFields] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [editValue, setEditValue] = useState("");

  const [completing, setCompleting] = useState(false);
  const [revealPhase, setRevealPhase] = useState(0);
  const [lastResponse, setLastResponse] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const initCalled = useRef(false);

  const firstName = extractFirstName(
    userName || user?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || ''
  );
  const userEmail = user?.email || session?.user?.email || '';

  const handleSignOut = async () => {
    try { await signOut(); localStorage.clear(); sessionStorage.clear(); window.location.href = '/login-supabase'; }
    catch { window.location.href = '/login-supabase'; }
  };

  useEffect(() => { if (!loading && !user) navigate("/login-supabase"); }, [loading, user, navigate]);

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

  const triggerComplete = () => { setCompleting(true); setEntry("completing"); setRevealPhase(0); };

  // Auto-save calibration progress after each step
  const autoSave = async (step, status = "IN_PROGRESS") => {
    try {
      await apiClient.post('/console/state', { current_step: step, status });
    } catch (e) {
      console.warn('Auto-save failed (non-blocking):', e);
    }
  };

  const applyResponse = async (data) => {
    if (data.question && data.options && data.options.length > 0) {
      setQuestion(data.question); setOptions(data.options); setAllowText(data.allow_text === true);
      setInsight(data.insight || null); setIsProbe(data.probe === true);
      setSelectedOption(null); setTextValue("");
      if (!data.probe) setCurrentStep(prev => data.step || prev + 1);
      setCalMode("wizard"); setEntry("calibrating"); return;
    }
    if (data.message) {
      setMessages(prev => [...prev, { role: "edge", text: data.message }]);
      setCalMode("chat"); setEntry("calibrating");
      // If response is just an acknowledgment (no question), auto-fetch next step
      if (!data.message.includes('?')) {
        try {
          const followUp = await callEdge({ step: currentStep + 1, message: "continue" });
          if (followUp.status === "COMPLETE") { triggerComplete(); return; }
          if (followUp.question && followUp.options?.length > 0) {
            setQuestion(followUp.question); setOptions(followUp.options); setAllowText(followUp.allow_text === true);
            setInsight(followUp.insight || null); setIsProbe(followUp.probe === true);
            setSelectedOption(null); setTextValue("");
            if (!followUp.probe) setCurrentStep(prev => followUp.step || prev + 1);
            setCalMode("wizard"); return;
          }
          if (followUp.message) setMessages(prev => [...prev, { role: "edge", text: followUp.message }]);
        } catch { /* stay in chat mode */ }
      }
      return;
    }
    const fb = data.text || data.response || JSON.stringify(data);
    if (fb) { setMessages(prev => [...prev, { role: "edge", text: fb }]); setCalMode("chat"); setEntry("calibrating"); }
  };

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

  const handleAuditSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !websiteUrl.trim()) return;
    let url = websiteUrl.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
    setError(null); setIsSubmitting(true); setEntry("analyzing");
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
      // Auto-save progress after each wizard step
      autoSave(currentStep, data.status === "COMPLETE" ? "COMPLETE" : "IN_PROGRESS");
      if (data.status === "COMPLETE") { triggerComplete(); return; }
      // Fallback: if we've answered all 9 steps but backend didn't flag COMPLETE, force it
      if (currentStep >= 9) { autoSave(9, "COMPLETE"); triggerComplete(); return; }
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
      // Auto-save progress after each chat response
      autoSave(currentStep);
      if (data.status === "COMPLETE") { autoSave(currentStep, "COMPLETE"); triggerComplete(); return; }
      if (data.question && data.options?.length > 0) { applyResponse(data); return; }
      if (data.message) {
        setMessages(prev => [...prev, { role: "edge", text: data.message }]);
        // If the AI response doesn't contain a question, auto-request the next step
        const hasQuestion = data.message.includes('?');
        if (!hasQuestion) {
          try {
            const followUp = await callEdge({ step: currentStep + 1, message: "continue" });
            if (followUp.status === "COMPLETE") { autoSave(currentStep + 1, "COMPLETE"); triggerComplete(); return; }
            if (followUp.question && followUp.options?.length > 0) { applyResponse(followUp); return; }
            if (followUp.message) setMessages(prev => [...prev, { role: "edge", text: followUp.message }]);
          } catch { /* silently continue in chat mode */ }
        }
      }
    } catch { setError("Calibration engine temporarily unavailable."); setInputValue(msg); }
    finally { setIsSubmitting(false); }
  };

  return {
    entry, setEntry, user, loading, firstName, userEmail, websiteUrl, setWebsiteUrl,
    wowSummary, editedFields, editingKey, editValue, setEditValue,
    isSubmitting, error, transitioning, revealPhase, lastResponse,
    calStep, calMode, question, options, allowText, insight,
    selectedOption, setSelectedOption, textValue, setTextValue,
    messages, inputValue, setInputValue,
    currentStep,
    handleSignOut, handleAuditSubmit, handleManualSummary,
    handleConfirmWow, startEdit, commitEdit,
    startCalibration, handleWizardContinue, handleChatSubmit,
  };
};
