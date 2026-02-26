import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { apiClient } from "../lib/api";
import { REVEAL_PHASES } from "../components/calibration/ExecutiveReveal";
import { parseIdentitySignals } from "../components/calibration/ForensicIdentityCard";

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

  // Identity verification state
  const [identitySignals, setIdentitySignals] = useState(null);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [identityConfidence, setIdentityConfidence] = useState(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

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
  const [intelligenceData, setIntelligenceData] = useState(null);
  const initCalled = useRef(false);

  const firstName = extractFirstName(
    userName || user?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || ''
  );
  const userEmail = user?.email || session?.user?.email || '';

  const handleSignOut = async () => {
    try {
      await signOut();
      const tutorials = localStorage.getItem('biqc_tutorials_seen');
      localStorage.clear(); sessionStorage.clear();
      if (tutorials) localStorage.setItem('biqc_tutorials_seen', tutorials);
      window.location.href = '/login-supabase';
    }
    catch {
      const tutorials = localStorage.getItem('biqc_tutorials_seen');
      localStorage.clear(); sessionStorage.clear();
      if (tutorials) localStorage.setItem('biqc_tutorials_seen', tutorials);
      window.location.href = '/login-supabase';
    }
  };

  useEffect(() => { if (!loading && !user) navigate("/login-supabase"); }, [loading, user, navigate]);

  useEffect(() => {
    if (!completing) return;
    const interval = setInterval(() => {
      setRevealPhase(p => {
        if (p >= REVEAL_PHASES.length - 1) {
          clearInterval(interval);
          setTimeout(() => { window.location.href = '/market'; }, 1200);
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

  const triggerComplete = () => {
    setCompleting(true); setEntry("completing"); setRevealPhase(0);
    (async () => {
      try {
        const token = session?.access_token;
        if (token) {
          await fetch(`${SUPABASE_URL}/functions/v1/calibration-sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
            body: '{}',
          }).catch(() => {});
          await fetch(`${SUPABASE_URL}/functions/v1/biqc-insights-cognitive`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
            body: '{"refresh": true}',
          }).catch(() => {});
        }
      } catch (e) { console.warn('[calibration] Sync failed (non-blocking):', e); }
    })();
  };

  const autoSave = async (step, status = "IN_PROGRESS") => {
    try {
      await apiClient.post('/console/state', { current_step: step, status });
    } catch (e) {
      console.warn('Auto-save failed (non-blocking):', e);
    }
  };

  const WIZARD_QUESTIONS = [
    { step: 1, field: 'communication_style', question: 'How do you prefer to receive information?', options: ['Bullet points — Just the key facts, fast', 'Narrative — Tell me the story, I\'ll find the insight', 'Data-first — Numbers, charts, evidence, then conclusions', 'Conversational — Talk to me like a trusted advisor'], insight: 'Understanding your communication style helps BIQc deliver intelligence the way you process it best.' },
    { step: 2, field: 'verbosity', question: 'How much detail do you want in your intelligence briefings?', options: ['Minimal — Headlines and actions only', 'Moderate — Key context with recommendations', 'Comprehensive — Full analysis with supporting evidence'], insight: 'This determines how deep your daily briefings go.' },
    { step: 3, field: 'bluntness', question: 'How direct should BIQc be when flagging problems?', options: ['Blunt — Give it to me straight, no sugar-coating', 'Balanced — Direct but diplomatic', 'Diplomatic — Soften the edges, focus on solutions'], insight: 'Your directness preference shapes how BIQc delivers hard truths.' },
    { step: 4, field: 'risk_posture', question: 'When it comes to risk, where do you sit?', options: ['Conservative — Protect what we have, minimise exposure', 'Moderate — Balanced approach, calculated risks only', 'Aggressive — Move fast, accept higher risk for higher reward'], insight: 'Your risk posture shapes how BIQc prioritises alerts and recommendations.' },
    { step: 5, field: 'decision_style', question: 'How do you typically make business decisions?', options: ['Gut instinct — Trust my experience and intuition', 'Data-driven — Show me the numbers first', 'Consensus — I consult my team before deciding', 'Hybrid — Mix of data and instinct depending on stakes'], insight: 'BIQc adapts its recommendations to match your decision-making style.' },
    { step: 6, field: 'accountability_cadence', question: 'How often do you want BIQc to check in with progress updates?', options: ['Daily — Keep me posted every day', 'Weekly — A weekly summary is enough', 'Ad-hoc — Only when something important happens', 'Milestone-based — Update me when goals are hit or missed'], insight: 'This sets the rhythm of your intelligence briefings.' },
    { step: 7, field: 'time_constraints', question: 'How would you describe your typical time pressure?', options: ['Always rushed — Every minute counts', 'Moderate — Busy but manageable', 'Has breathing room — I make time for strategy'], insight: 'BIQc adjusts the depth and urgency of communications based on your schedule.' },
    { step: 8, field: 'challenge_tolerance', question: 'How much should BIQc challenge your thinking?', options: ['Challenge me — Push back on my assumptions', 'Balanced — Challenge when it matters, support otherwise', 'Support me — Reinforce my direction, flag risks gently'], insight: 'This determines how assertive BIQc is in its advisory role.' },
    { step: 9, field: 'boundaries', question: 'Are there any topics or areas BIQc should avoid?', options: ['No boundaries — Cover everything', 'Personal topics off-limits — Business only', 'Specific areas to avoid — I\'ll configure later'], insight: 'Setting boundaries ensures BIQc stays within your comfort zone.', allowText: true },
  ];

  const applyResponse = async (data) => {
    if (data.question && data.options && data.options.length > 0) {
      setQuestion(data.question); setOptions(data.options); setAllowText(data.allow_text === true);
      setInsight(data.insight || null); setIsProbe(data.probe === true);
      setSelectedOption(null); setTextValue("");
      if (!data.probe) setCurrentStep(prev => data.step || prev + 1);
      setCalMode("wizard"); setEntry("calibrating"); return;
    }
    const nextStep = Math.min(currentStep + 1, 9);
    const wizardQ = WIZARD_QUESTIONS.find(q => q.step === nextStep) || WIZARD_QUESTIONS.find(q => q.step === currentStep);
    if (wizardQ) {
      setQuestion(wizardQ.question); setOptions(wizardQ.options);
      setAllowText(wizardQ.allowText || false); setInsight(wizardQ.insight || null);
      setSelectedOption(null); setTextValue(""); setCurrentStep(wizardQ.step);
      setCalMode("wizard"); setEntry("calibrating"); return;
    }
    if (data.message) {
      setMessages(prev => [...prev, { role: "edge", text: data.message }]);
      setCalMode("wizard"); setEntry("calibrating");
    }
  };

  const detectState = async () => {
    try {
      const res = await apiClient.get('/calibration/status');
      const d = res.data;
      setUserName(d.user_name || '');
      if (d.status === 'COMPLETE') { window.location.href = '/market'; return; }
      if (d.status === 'IN_PROGRESS' && d.calibration_step > 1) {
        autoSave(9, "COMPLETE");
        triggerComplete();
        return;
      }
      setEntry("ignition");
    } catch { setEntry("ignition"); }
  };

  const isWowSufficient = (wow) => {
    if (!wow || typeof wow !== 'object') return false;
    const vals = Object.values(wow).filter(v => typeof v === 'string' && v.trim().length > 20);
    return vals.length >= 3;
  };

  // ═══ PHASE 1: Domain Entry + Scan ═══
  const handleAuditSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !websiteUrl.trim()) return;
    let url = websiteUrl.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
    setError(null); setIsSubmitting(true); setEntry("analyzing");
    try {
      try { await apiClient.put('/business-profile', { website: url }); } catch {}

      const token = session?.access_token;
      let auditData = null;
      if (token) {
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/calibration-business-dna`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
            body: JSON.stringify({ website_url: url }),
          });
          if (res.ok) { auditData = await res.json(); }
        } catch {}
      }

      if (auditData?.extracted_data) {
        const ex = auditData.extracted_data;

        const fullExtraction = {
          ...ex,
          _sources: auditData.data_sources || [],
          _website: url,
          _generated_at: auditData.generated_at || new Date().toISOString(),
        };

        const wow = {
          business_name: ex.business_name || ex.name || ex.company || '',
          what_you_do: ex.main_products_services || ex.business_overview || ex.description || ex.about || '',
          who_you_serve: ex.target_market || ex.ideal_customer_profile || ex.audience || '',
          what_sets_you_apart: ex.competitive_advantages || ex.unique_value_proposition || ex.differentiators || '',
          biggest_challenges: ex.main_challenges || ex.key_challenges || ex.challenges || '',
          growth_opportunity: ex.growth_strategy || ex.industry_position || ex.market_position || '',
          _full: fullExtraction,
        };

        if (!isWowSufficient(wow)) {
          wow.what_you_do = wow.what_you_do || 'Unable to extract enough detail — please describe your business below.';
        }

        setWowSummary(wow);

        // Parse identity signals from extracted data
        const signals = parseIdentitySignals(ex, url);
        setIdentitySignals(signals);
        setIdentityConfirmed(false);

        autoSave(1);
        // NEW FLOW: Go to identity_verification BEFORE footprint report
        setEntry("identity_verification");
      } else {
        setEntry("manual_summary");
      }
    } catch { setEntry("manual_summary"); }
    finally { setIsSubmitting(false); }
  };

  const handleManualSummary = async (summary) => {
    setIsSubmitting(true); setEntry("analyzing");
    try {
      await apiClient.put('/business-profile', { mission_statement: summary });
      try { await callEdge({ step: 1, message: summary }); } catch {}
      autoSave(1);
      setWowSummary({ what_you_do: summary, who_you_serve: '', what_sets_you_apart: '', biggest_challenges: '', growth_opportunity: '' });
      // Manual entry goes to identity verification with minimal signals
      setIdentitySignals({ domain: websiteUrl, businessName: '', whatYouDo: summary });
      setIdentityConfirmed(false);
      setEntry("identity_verification");
    } catch { setError("Failed to save. Please try again."); }
    finally { setIsSubmitting(false); }
  };

  // ═══ PHASE 3: Identity Verification Handlers ═══
  const handleConfirmIdentity = (confirmedSignals) => {
    setIdentityConfirmed(true);
    setIdentityConfidence(confirmedSignals.confidence || 'Medium');
    setIdentitySignals(confirmedSignals);

    // Save confirmed identity to business profile
    (async () => {
      try {
        const updates = {};
        if (confirmedSignals.businessName) updates.business_name = confirmedSignals.businessName;
        if (confirmedSignals.address) updates.location = confirmedSignals.address;
        if (confirmedSignals.abn) updates.abn = confirmedSignals.abn;
        if (Object.keys(updates).length > 0) await apiClient.put('/business-profile', updates);
      } catch {}
    })();

    autoSave(2);
    // Proceed to Chief Marketing Summary (footprint report)
    setEntry("wow_summary");
  };

  const handleRegenerateIdentity = async (hints) => {
    setIsRegenerating(true);
    setIdentityConfirmed(false);
    setIdentitySignals(null);
    setEntry("analyzing");

    let url = websiteUrl.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;

    try {
      const token = session?.access_token;
      if (token) {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/calibration-business-dna`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
          body: JSON.stringify({
            website_url: url,
            business_name_hint: hints?.businessName || hints?.legalName || '',
            location_hint: hints?.address || hints?.suburb || '',
            abn_hint: hints?.abn || '',
          }),
        });
        if (res.ok) {
          const auditData = await res.json();
          if (auditData?.extracted_data) {
            const ex = auditData.extracted_data;
            const fullExtraction = { ...ex, _sources: auditData.data_sources || [], _website: url, _generated_at: new Date().toISOString() };

            const wow = {
              business_name: ex.business_name || ex.name || ex.company || '',
              what_you_do: ex.main_products_services || ex.business_overview || ex.description || ex.about || '',
              who_you_serve: ex.target_market || ex.ideal_customer_profile || ex.audience || '',
              what_sets_you_apart: ex.competitive_advantages || ex.unique_value_proposition || ex.differentiators || '',
              biggest_challenges: ex.main_challenges || ex.key_challenges || ex.challenges || '',
              growth_opportunity: ex.growth_strategy || ex.industry_position || ex.market_position || '',
              _full: fullExtraction,
            };
            setWowSummary(wow);

            const signals = parseIdentitySignals(ex, url);
            // Merge user hints into signals
            if (hints?.businessName || hints?.legalName) signals.businessName = hints.businessName || hints.legalName || signals.businessName;
            if (hints?.address || hints?.suburb) signals.address = hints.address || hints.suburb || signals.address;
            if (hints?.abn) signals.abn = hints.abn || signals.abn;
            setIdentitySignals(signals);
            setEntry("identity_verification");
            setIsRegenerating(false);
            return;
          }
        }
      }
      setEntry("identity_verification");
    } catch {
      setEntry("identity_verification");
    }
    setIsRegenerating(false);
  };

  const handleRejectIdentity = async (rejectData) => {
    // Reject clears identity and re-scans with user-provided hints
    await handleRegenerateIdentity({
      legalName: rejectData?.legalName || '',
      suburb: rejectData?.suburb || '',
      abn: rejectData?.abn || '',
    });
  };

  // ═══ PHASE 4: Footprint Report (CMS) Confirmation ═══
  const handleConfirmWow = async () => {
    setError(null); setTransitioning(true);
    if (Object.keys(editedFields).length > 0 && wowSummary && typeof wowSummary === 'object') {
      const updated = { ...wowSummary };
      for (const [key, val] of Object.entries(editedFields)) {
        if (updated[key] !== undefined) updated[key] = val;
      }
      setWowSummary(updated);
    }
    await new Promise(r => setTimeout(r, 2000));
    setIsSubmitting(true);
    try {
      const payload = { step: 2, confirmed_summary: true };
      if (Object.keys(editedFields).length > 0) payload.user_edits = editedFields;
      try { await callEdge(payload); } catch {}

      try {
        const wowToSave = { ...(wowSummary || {}), ...editedFields };
        await apiClient.put('/business-profile', {
          business_name: wowToSave.business_name || '',
          mission_statement: wowToSave.what_you_do || '',
          target_market: wowToSave.who_you_serve || '',
        });
      } catch {}

      autoSave(3);
      setTransitioning(false);

      // Identity is already confirmed (Phase 3). Go straight to snapshot.
      fetchIntelligence();
      setEntry("intelligence-first");
    } catch { setTransitioning(false); setError("Calibration engine temporarily unavailable."); }
    finally { setIsSubmitting(false); }
  };

  // ═══ PHASE 5: Snapshot → Dashboard ═══
  const proceedFromIntelligence = () => {
    autoSave(9, "COMPLETE");
    triggerComplete();
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
    autoSave(9, "COMPLETE");
    triggerComplete();
  };

  const handleWizardContinue = async () => {
    if (isSubmitting || !selectedOption) return;
    setError(null); setIsSubmitting(true); setLastResponse(selectedOption); setCalMode(null);
    const payload = { step: currentStep, selected: selectedOption, user_response: selectedOption };
    if (textValue.trim()) payload.text = textValue.trim();
    if (isProbe) payload.probe = true;
    try {
      const data = await callEdge(payload);
      autoSave(currentStep, data.status === "COMPLETE" ? "COMPLETE" : "IN_PROGRESS");
      if (data.status === "COMPLETE") { triggerComplete(); return; }
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
      const data = await callEdge({ message: msg, step: currentStep });
      setCurrentStep(prev => {
        const next = data.step || prev + 1;
        return Math.min(next, 9);
      });
      autoSave(currentStep + 1);
      if (data.status === "COMPLETE") { autoSave(9, "COMPLETE"); triggerComplete(); return; }
      if (data.question && data.options?.length > 0) { applyResponse(data); return; }
      if (data.message) {
        setMessages(prev => [...prev, { role: "edge", text: data.message }]);
        const hasQuestion = data.message.includes('?');
        if (!hasQuestion) {
          try {
            const nextStep = Math.min(currentStep + 2, 9);
            const followUp = await callEdge({ step: nextStep, message: "continue" });
            if (followUp.status === "COMPLETE") { autoSave(9, "COMPLETE"); triggerComplete(); return; }
            if (followUp.question && followUp.options?.length > 0) { applyResponse(followUp); return; }
            if (followUp.message) setMessages(prev => [...prev, { role: "edge", text: followUp.message }]);
          } catch {}
        }
      }
    } catch { setError("Calibration engine temporarily unavailable."); setInputValue(msg); }
    finally { setIsSubmitting(false); }
  };

  const fetchIntelligence = async () => {
    try {
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/biqc-insights-cognitive`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: '{}',
      });
      if (res.ok) {
        const data = await res.json();
        setIntelligenceData(data);
      }
    } catch {}
  };

  return {
    entry, setEntry, user, loading, firstName, userEmail, websiteUrl, setWebsiteUrl,
    wowSummary, editedFields, editingKey, editValue, setEditValue,
    isSubmitting, error, transitioning, revealPhase, lastResponse,
    calStep, calMode, question, options, allowText, insight,
    selectedOption, setSelectedOption, textValue, setTextValue,
    messages, inputValue, setInputValue,
    currentStep, intelligenceData, fetchIntelligence, proceedFromIntelligence,
    // Identity verification
    identitySignals, identityConfirmed, identityConfidence, isRegenerating,
    handleConfirmIdentity, handleRegenerateIdentity, handleRejectIdentity,
    handleSignOut, handleAuditSubmit, handleManualSummary,
    handleConfirmWow,
    startEdit, commitEdit,
    startCalibration, handleWizardContinue, handleChatSubmit,
  };
};
