import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { apiClient, callEdgeFunction } from "../lib/api";
import { REVEAL_PHASES } from "../components/calibration/ExecutiveReveal";
import { parseIdentitySignals } from "../components/calibration/ForensicIdentityCard";
import { EVENTS, trackActivationStep, trackOnceForUser } from "../lib/analytics";

const extractFirstName = (raw) => {
  if (!raw) return '';
  if (raw.includes('@')) {
    const namePart = raw.split('@')[0].split(/[._-]/)[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  }
  return raw.split(' ')[0];
};

const MAX_SCAN_ATTEMPTS_BEFORE_MANUAL = 2;
const MIN_ANALYZE_DWELL_MS = 12000;

const SCAN_ERROR_MESSAGES = {
  INVALID_WEBSITE_URL: "Website URL looks invalid. Check the domain and try scanning again.",
  WEBSITE_UNREACHABLE: "We could not reach that website. Check the URL and try regenerating the scan.",
  WEBSITE_TIMEOUT: "Website scan timed out. Confirm the URL and regenerate the scan.",
  INSUFFICIENT_PUBLIC_CONTENT: "We could not extract enough public content. Confirm website details and regenerate the scan.",
  AI_EXTRACTION_FAILED: "Scan completed but extraction failed. Please regenerate the scan.",
  AI_RESPONSE_PARSE_FAILED: "Scan response was incomplete. Please regenerate the scan.",
  EDGE_PROXY_UNAVAILABLE: "Scan service is temporarily unavailable. Please try again in a moment.",
  EDGE_FUNCTION_TIMEOUT: "Scan service timed out. Please regenerate the scan.",
  EDGE_FUNCTION_UNAVAILABLE: "Scan engine is temporarily unavailable. Please try again.",
  EDGE_PROXY_FAILURE: "Scan gateway is temporarily unavailable. Please try again.",
  UNKNOWN_SCAN_FAILURE: "Scan did not complete. Check website details and regenerate the scan.",
};

const getScanFailure = (error, fallbackCode = "UNKNOWN_SCAN_FAILURE") => {
  const responseData = error?.response?.data || {};
  const detailPayload =
    responseData && typeof responseData.detail === "object" ? responseData.detail : {};
  const status = error?.response?.status;
  const code =
    responseData.code ||
    detailPayload.code ||
    responseData.error_code ||
    responseData.detail_code ||
    responseData.detail ||
    fallbackCode;
  const stage = responseData.stage || detailPayload.stage || "scan";
  const details =
    responseData.details ||
    detailPayload.details ||
    responseData.message ||
    detailPayload.error ||
    "";
  return {
    code,
    stage,
    status,
    details,
    message: SCAN_ERROR_MESSAGES[code] || SCAN_ERROR_MESSAGES.UNKNOWN_SCAN_FAILURE,
  };
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 25000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const normalizeAbn = (abn) => (abn || "").replace(/\s/g, "");

export const isValidAbn = (abn) => /^\d{11}$/.test(normalizeAbn(abn));

export const normalizeSocialUrl = (url) => {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export const SOCIAL_PLATFORMS = ["linkedin", "facebook", "instagram", "twitter", "youtube"];
export const CALIBRATION_FLOW_SEQUENCE = [
  "welcome",
  "analyzing",
  "abn_validation",
  "social_enrichment",
  "identity_verification",
  "wow_cards",
  "deep_narrative",
  "roadmap",
  "report_generation",
  "wow_summary",
  "agent_calibration",
  "integration_connect",
  "intelligence-first",
  "completing",
];

export const getNextCalibrationState = (state) => {
  const idx = CALIBRATION_FLOW_SEQUENCE.indexOf(state);
  if (idx < 0 || idx >= CALIBRATION_FLOW_SEQUENCE.length - 1) return null;
  return CALIBRATION_FLOW_SEQUENCE[idx + 1];
};

export const collectSocialMap = (input) => {
  const out = {};
  if (!input) return out;
  for (const platform of SOCIAL_PLATFORMS) out[platform] = "";

  if (Array.isArray(input)) {
    for (const item of input) {
      const key = (item?.platform || "").toLowerCase();
      if (!SOCIAL_PLATFORMS.includes(key)) continue;
      if (!out[key]) out[key] = normalizeSocialUrl(item?.url || "");
    }
    return out;
  }

  if (typeof input === "object") {
    for (const [keyRaw, valueRaw] of Object.entries(input)) {
      const key = String(keyRaw).toLowerCase();
      const mapped = key === "x" ? "twitter" : key;
      if (!SOCIAL_PLATFORMS.includes(mapped)) continue;
      if (!out[mapped]) out[mapped] = normalizeSocialUrl(valueRaw);
    }
  }
  return out;
};

export const mergeSocialSignals = ({ perplexity, html, search }) => {
  const p = collectSocialMap(perplexity);
  const h = collectSocialMap(html);
  const s = collectSocialMap(search);
  const merged = { linkedin: "", facebook: "", instagram: "", twitter: "", youtube: "" };
  let source = "";

  for (const platform of SOCIAL_PLATFORMS) {
    if (p[platform]) {
      merged[platform] = p[platform];
      source = source || "perplexity";
      continue;
    }
    if (h[platform]) {
      merged[platform] = h[platform];
      source = source || "html";
      continue;
    }
    if (s[platform]) {
      merged[platform] = s[platform];
      source = source || "search";
    }
  }

  const filled = SOCIAL_PLATFORMS.filter((k) => !!merged[k]).length;
  return {
    ...merged,
    source: source || "search",
    social_status: filled === 0 ? "not_detected" : (filled === SOCIAL_PLATFORMS.length ? "verified" : "partial"),
  };
};

export const buildAbnIdentityMetadata = ({ lookupResult, abnInputDetected }) => {
  if (lookupResult?.status === "found") {
    return {
      abn_verified: true,
      abn_source: abnInputDetected ? "website" : "gud_api",
      legal_name: lookupResult.legal_name || "",
      entity_status: lookupResult.status || lookupResult.entity_status || "",
      registered_address: lookupResult.address || "",
      abn_status: "verified",
      _abnLookupResult: lookupResult,
    };
  }

  if (lookupResult?.status === "ambiguous") {
    return {
      abn_verified: false,
      abn_source: "gud_api",
      legal_name: "",
      entity_status: "",
      registered_address: "",
      abn_status: "multiple",
      _abnLookupResult: lookupResult,
    };
  }

  return {
    abn_verified: false,
    abn_source: abnInputDetected ? "website" : "gud_api",
    legal_name: "",
    entity_status: "",
    registered_address: "",
    abn_status: "not_found",
    _abnLookupResult: lookupResult || null,
  };
};

const buildExtractionFromDeepEnrichment = (deepEnrichment) => {
  if (!deepEnrichment || typeof deepEnrichment !== "object") return null;
  const hasUsableContent = [
    deepEnrichment.business_name,
    deepEnrichment.description,
    deepEnrichment.main_products_services,
    deepEnrichment.target_market,
    deepEnrichment.unique_value_proposition,
    deepEnrichment.competitive_advantages,
    deepEnrichment.market_position,
    deepEnrichment.abn,
  ].some((v) => typeof v === "string" && v.trim().length > 0) || (
    Array.isArray(deepEnrichment.competitors) && deepEnrichment.competitors.length > 0
  );

  if (!hasUsableContent) return null;

  return {
    business_name: deepEnrichment.business_name || "",
    description: deepEnrichment.description || "",
    industry: deepEnrichment.industry || "",
    main_products_services: deepEnrichment.main_products_services || "",
    target_market: deepEnrichment.target_market || "",
    unique_value_proposition: deepEnrichment.unique_value_proposition || "",
    competitive_advantages: deepEnrichment.competitive_advantages || "",
    market_position: deepEnrichment.market_position || "",
    competitor_scan_result: deepEnrichment.competitor_analysis || "",
    abn: deepEnrichment.abn || "",
    competitors: Array.isArray(deepEnrichment.competitors) ? deepEnrichment.competitors : [],
    social_media_links: deepEnrichment.social_handles || {},
    trust_signals: Array.isArray(deepEnrichment.trust_signals) ? deepEnrichment.trust_signals : [],
    executive_summary: deepEnrichment.executive_summary || "",
    cmo_executive_brief: deepEnrichment.cmo_executive_brief || "",
    seo_analysis: deepEnrichment.seo_analysis || null,
    paid_media_analysis: deepEnrichment.paid_media_analysis || null,
    social_media_analysis: deepEnrichment.social_media_analysis || null,
    website_health: deepEnrichment.website_health || null,
    swot: deepEnrichment.swot || null,
    competitor_swot: Array.isArray(deepEnrichment.competitor_swot) ? deepEnrichment.competitor_swot : [],
    cmo_priority_actions: Array.isArray(deepEnrichment.cmo_priority_actions) ? deepEnrichment.cmo_priority_actions : [],
    deep_scan_sources: deepEnrichment.sources || null,
  };
};

const buildExtractionFromScrapeProfile = (scrapeProfile, websiteUrl = "") => {
  if (!scrapeProfile || typeof scrapeProfile !== "object") return null;
  const businessName = (scrapeProfile.business_name || "").trim();
  const description = (
    scrapeProfile.description ||
    scrapeProfile.meta_description ||
    scrapeProfile.h1 ||
    ""
  ).trim();

  if (!businessName && !description) return null;

  return {
    business_name: businessName,
    description,
    industry: "",
    main_products_services: description,
    target_market: "",
    unique_value_proposition: "",
    competitive_advantages: "",
    market_position: "",
    competitor_scan_result: "",
    abn: "",
    competitors: [],
    social_media_links: {},
    trust_signals: [],
    executive_summary: "",
    cmo_executive_brief: "",
    deep_scan_sources: null,
    _website: websiteUrl,
  };
};

const buildExtractionFromUrlFallback = (websiteUrl = "") => {
  const raw = (websiteUrl || "").trim();
  let host = raw;
  try {
    host = new URL(raw).hostname || raw;
  } catch {
    host = raw.replace(/^https?:\/\//i, "").split("/")[0] || raw;
  }
  const cleaned = host.replace(/^www\./i, "").trim();

  // Deterministic minimal payload so calibration flow can continue without fabricating facts.
  return {
    business_name: "",
    description: "Insufficient verified data",
    industry: "",
    main_products_services: "",
    target_market: "",
    unique_value_proposition: "",
    competitive_advantages: "",
    market_position: "",
    competitor_scan_result: "",
    abn: "",
    competitors: [],
    social_media_links: {},
    trust_signals: [],
    executive_summary: "",
    cmo_executive_brief: "",
    deep_scan_sources: null,
    _website: cleaned || websiteUrl || "",
  };
};

export const useCalibrationState = () => {
  const navigate = useNavigate();
  const { user, session, loading, signOut, clearBootstrapCache } = useSupabaseAuth();
  const supabase = useSupabaseAuth().supabase;
  const isCalibrationQaRoute = (() => {
    if (typeof window === "undefined") return false;
    const pathname = (window.location?.pathname || "").replace(/\/+$/, "");
    return pathname === "/calibration-qa";
  })();

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
  const [scanFailure, setScanFailure] = useState(null);
  const [scanAttemptCount, setScanAttemptCount] = useState(0);
  const [lastScanUrl, setLastScanUrl] = useState("");

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
  const [deepCmoReport, setDeepCmoReport] = useState(null);
  const [deepCmoReportHistory, setDeepCmoReportHistory] = useState([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [abnValidationResult, setAbnValidationResult] = useState(null);
  const initCalled = useRef(false);

  const firstName = extractFirstName(
    userName || user?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || ''
  );
  const userEmail = user?.email || session?.user?.email || '';
  const canManualFallback = scanAttemptCount >= MAX_SCAN_ATTEMPTS_BEFORE_MANUAL;

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

  useEffect(() => { if (!loading && !user && !isCalibrationQaRoute) navigate("/login-supabase"); }, [loading, user, navigate, isCalibrationQaRoute]);

  useEffect(() => {
    if (!completing) return;
    const interval = setInterval(() => {
      setRevealPhase(p => {
        if (p >= REVEAL_PHASES.length - 1) {
          clearInterval(interval);
          setTimeout(() => { navigate('/market', { replace: true }); }, 1200);
          return p;
        }
        return p + 1;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, [completing, navigate]);

  useEffect(() => {
    const shouldInit = !loading && !initCalled.current && ((user && session) || isCalibrationQaRoute);
    if (shouldInit) {
      initCalled.current = true;
      detectState();
    }
  }, [loading, user, session, isCalibrationQaRoute]); // eslint-disable-line react-hooks/exhaustive-deps

  // When users navigate back to the calibration entry screen, clear any prior
  // scan artifacts so stale business data cannot bleed into a new run.
  useEffect(() => {
    if (entry !== "welcome") return;
    setWowSummary(null);
    setIdentitySignals(null);
    setIdentityConfirmed(false);
    setIdentityConfidence(null);
    setEditedFields({});
    setEditingKey(null);
    setError(null);
    setTransitioning(false);
    setIntelligenceData(null);
    setDeepCmoReport(null);
    setDeepCmoReportHistory([]);
    setIsGeneratingReport(false);
    setAbnValidationResult(null);
  }, [entry]);

  const registerScanFailure = (failure, attemptedUrl, attempts) => {
    setScanFailure(failure);
    setError(failure?.message || SCAN_ERROR_MESSAGES.UNKNOWN_SCAN_FAILURE);
    if (attemptedUrl) setWebsiteUrl(attemptedUrl);
    setScanAttemptCount(attempts);
    setIsRegenerating(false);
    setIsSubmitting(false);
    setEntry("welcome");
  };

  const ensureAnalyzeDwell = async (startedAtMs) => {
    const elapsed = Date.now() - (startedAtMs || 0);
    const remaining = MIN_ANALYZE_DWELL_MS - elapsed;
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  };

  const callEdge = async (payload) => {
    return await callEdgeFunction("calibration-psych", payload, 30000);
  };

  const triggerComplete = () => {
    trackOnceForUser(EVENTS.ACTIVATION_CALIBRATION_COMPLETE, session?.user?.id, { source: 'calibration' });
    trackActivationStep('calibration_complete', { source: 'calibration' });
    // Clear stale auth bootstrap cache so the next page load re-checks calibration status
    // from the server instead of reading the cached NEEDS_CALIBRATION state.
    try { clearBootstrapCache(); } catch {}
    setCompleting(true); setEntry("completing"); setRevealPhase(0);
    (async () => {
      try {
        await callEdgeFunction('calibration-sync', {}).catch(() => {});
        await callEdgeFunction('biqc-insights-cognitive', { refresh: true }).catch(() => {});
      } catch (e) { console.warn('[calibration] Sync failed (non-blocking):', e); }
    })();
  };

  const autoSave = async (step, status = "IN_PROGRESS") => {
    try {
      await apiClient.post('/console/state', { current_step: step, status });
    } catch (e) {
      console.warn('Auto-save API failed (non-blocking):', e);
    }
    // Belt-and-suspenders: write COMPLETE directly to Supabase so it is
    // never lost due to API timing or network issues on redirect.
    if (status === "COMPLETE" && session?.user?.id) {
      try {
        await supabase.from('strategic_console_state').upsert({
          user_id: session.user.id,
          status: 'COMPLETE',
          is_complete: true,
          current_step: step,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        await supabase.from('user_operator_profile').upsert({
          user_id: session.user.id,
          persona_calibration_status: 'complete',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      } catch (sbErr) {
        console.warn('Auto-save Supabase direct write failed:', sbErr);
      }
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
      if (d.status === 'COMPLETE') {
        // Clear cache so /market page load fetches fresh COMPLETE status
        try { clearBootstrapCache(); } catch {}
        navigate('/market', { replace: true }); return;
      }
      setEntry("ignition");
    } catch { setEntry("ignition"); }
  };

  const isWowSufficient = (wow) => {
    if (!wow || typeof wow !== 'object') return false;
    const vals = Object.values(wow).filter(v => typeof v === 'string' && v.trim().length > 20);
    return vals.length >= 3;
  };

  const runAbnValidation = async ({ extractedData, edgeSignals, website, currentSignals }) => {
    const extractedAbn = extractedData?.abn || "";
    const candidateAbn = Array.isArray(edgeSignals?.abn_candidates) ? edgeSignals.abn_candidates[0] : "";
    const abnToValidate = isValidAbn(extractedAbn) ? extractedAbn : (isValidAbn(candidateAbn) ? candidateAbn : "");
    const lookupPayload = abnToValidate
      ? { abn: abnToValidate }
      : {
          business_name_hint: extractedData?.business_name || currentSignals?.businessName || "",
          location_hint: extractedData?.location || currentSignals?.address || currentSignals?.geo || "",
          domain: website || "",
        };

    let lookupResult = null;
    try {
      lookupResult = await callEdgeFunction("business-identity-lookup", lookupPayload, 30000);
    } catch {
      lookupResult = null;
    }

    return buildAbnIdentityMetadata({
      lookupResult,
      abnInputDetected: !!abnToValidate,
    });
  };

  // ═══ PHASE 1: Domain Entry + Scan ═══
  const handleAuditSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !websiteUrl.trim()) return;
    let url = websiteUrl.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
    const normalizedUrl = url.trim().toLowerCase();
    const attempts = normalizedUrl === lastScanUrl ? scanAttemptCount + 1 : 1;
    setLastScanUrl(normalizedUrl);
    setScanAttemptCount(attempts);
    setScanFailure(null);
    setWowSummary(null);
    setIdentitySignals(null);
    setIdentityConfirmed(false);
    setIdentityConfidence(null);
    setEditedFields({});
    setError(null); setIsSubmitting(true); setEntry("analyzing");
    const analyzeStartedAt = Date.now();
    try {
      // Clear potentially contaminated intelligence fields before new calibration scan
      // This prevents cross-business data bleeding from previous calibrations
      // Column list verified against actual business_profiles schema
      try {
        await apiClient.put('/business-profile', {
          website: url,
          market_position: null,
          main_products_services: null,
          unique_value_proposition: null,
          competitive_advantages: null,
          target_market: null,
          ideal_customer_profile: null,
          geographic_focus: null,
          abn: null,
          competitor_scan_result: null,
        });
      } catch {
        // Non-fatal — continue with calibration even if reset fails
      }

      let auditData = null;
      let deepEnrichment = null;
      let edgeScanError = null;
      let scrapeProfile = null;

      // FAST PRE-FILL: scrape-business-profile runs instantly (no LLM, pure HTML)
      // Gives users immediate feedback while AI analysis runs
      {
        try {
          const scrapeData = await callEdgeFunction('scrape-business-profile', { url }, 15000);
          scrapeProfile = scrapeData;
          if (scrapeData?.business_name || scrapeData?.description) {
            // Instantly pre-fill what we have from HTML
            setIdentitySignals({
              domain: url,
              businessName: scrapeData.business_name || '',
              whatYouDo: scrapeData.description || scrapeData.meta_description || '',
            });
          }
        } catch { /* non-fatal — AI analysis continues below */ }
      }

      try {
        auditData = await callEdgeFunction('calibration-business-dna', { website_url: url }, 90000);
          if (auditData?.status === "error" || auditData?.ok === false || auditData?.error_code) {
            const syntheticError = {
              response: {
                status: 422,
                data: {
                  code: auditData?.error_code || "UNKNOWN_SCAN_FAILURE",
                  stage: auditData?.stage || "scan",
                  details: auditData?.error || "",
                },
              },
            };
            throw syntheticError;
          }
      } catch (scanErr) {
        edgeScanError = scanErr;
      }

      // Deep backend enrichment (Trinity + web search + ABN + competitor scan)
      try {
        const deepRes = await apiClient.post('/calibration/enrichment/website', { url, action: 'scan' });
        if (deepRes?.data?.enrichment && typeof deepRes.data.enrichment === "object") {
          deepEnrichment = deepRes.data.enrichment;
        }
      } catch {
        // non-fatal; continue with edge extraction
      }

      const exRaw =
        auditData?.extracted_data ||
        buildExtractionFromDeepEnrichment(deepEnrichment) ||
        buildExtractionFromScrapeProfile(scrapeProfile, url) ||
        buildExtractionFromUrlFallback(url);
      if (exRaw) {
        const ex = {
          ...exRaw,
          ...(deepEnrichment ? {
            business_name: deepEnrichment.business_name || exRaw.business_name,
            description: deepEnrichment.description || exRaw.description,
            industry: deepEnrichment.industry || exRaw.industry,
            main_products_services: deepEnrichment.main_products_services || exRaw.main_products_services,
            target_market: deepEnrichment.target_market || exRaw.target_market,
            unique_value_proposition: deepEnrichment.unique_value_proposition || exRaw.unique_value_proposition,
            competitive_advantages: deepEnrichment.competitive_advantages || exRaw.competitive_advantages,
            market_position: deepEnrichment.market_position || exRaw.market_position,
            competitor_scan_result: deepEnrichment.competitor_analysis || exRaw.competitor_scan_result,
            abn: deepEnrichment.abn || exRaw.abn,
            competitors: Array.isArray(deepEnrichment.competitors) ? deepEnrichment.competitors : (exRaw.competitors || []),
            social_media_links: deepEnrichment.social_handles || exRaw.social_media_links || {},
            trust_signals: deepEnrichment.trust_signals || exRaw.trust_signals || [],
            executive_summary: deepEnrichment.executive_summary || exRaw.executive_summary || '',
            cmo_executive_brief: deepEnrichment.cmo_executive_brief || exRaw.cmo_executive_brief || '',
            seo_analysis: deepEnrichment.seo_analysis || exRaw.seo_analysis || null,
            paid_media_analysis: deepEnrichment.paid_media_analysis || exRaw.paid_media_analysis || null,
            social_media_analysis: deepEnrichment.social_media_analysis || exRaw.social_media_analysis || null,
            website_health: deepEnrichment.website_health || exRaw.website_health || null,
            swot: deepEnrichment.swot || exRaw.swot || null,
            competitor_swot: deepEnrichment.competitor_swot || exRaw.competitor_swot || [],
            cmo_priority_actions: deepEnrichment.cmo_priority_actions || exRaw.cmo_priority_actions || [],
            deep_scan_sources: deepEnrichment.sources || null,
          } : {}),
        };

        const fullExtraction = {
          ...ex,
          _sources: auditData?.data_sources || [],
          _deep_sources: deepEnrichment?.sources || null,
          _website: url,
          _generated_at: auditData?.generated_at || new Date().toISOString(),
        };

        const wow = {
          business_name: ex.business_name || ex.name || ex.company || '',
          what_you_do: ex.main_products_services || ex.business_overview || ex.description || ex.about || '',
          who_you_serve: ex.target_market || ex.ideal_customer_profile || ex.audience || '',
          what_sets_you_apart: ex.competitive_advantages || ex.unique_value_proposition || ex.differentiators || '',
          biggest_challenges: ex.main_challenges || ex.key_challenges || ex.challenges || '',
          growth_opportunity: ex.growth_strategy || ex.industry_position || ex.market_position || '',
          competitors: Array.isArray(ex.competitors) ? ex.competitors.join(', ') : '',
          abn: ex.abn || '',
          _full: fullExtraction,
        };

        if (!isWowSufficient(wow)) {
          wow.what_you_do = wow.what_you_do || 'Unable to extract enough detail — please describe your business below.';
        }

        setWowSummary(wow);

        // Parse identity signals from extracted data
        // Merge deterministic signals from Edge Function if available
        const signals = parseIdentitySignals(ex, url);

        // Merge Edge Function's deterministic identity_signals (ABN, phone, email, socials, address)
        const edgeSignals = auditData?.identity_signals || ex._identity_signals || {};
        if (edgeSignals.abn_candidates?.length > 0 && !signals.abn) {
          signals.abn = edgeSignals.abn_candidates[0];
        }
        if (deepEnrichment?.abn && !signals.abn) {
          signals.abn = deepEnrichment.abn;
        }
        if (!signals.abn && Array.isArray(deepEnrichment?.abn_candidates) && deepEnrichment.abn_candidates.length > 0) {
          signals.abn = deepEnrichment.abn_candidates[0];
        }
        if (edgeSignals.phone_numbers?.length > 0 && signals.phones?.length === 0) {
          signals.phones = edgeSignals.phone_numbers;
        }
        if (edgeSignals.email_addresses?.length > 0 && signals.emails?.length === 0) {
          signals.emails = edgeSignals.email_addresses;
        }
        if (edgeSignals.address_candidates?.length > 0 && !signals.address) {
          signals.address = edgeSignals.address_candidates[0];
        }
        if (edgeSignals.geographic_mentions?.length > 0 && !signals.geo) {
          signals.geo = edgeSignals.geographic_mentions.join(', ');
        }
        if (edgeSignals.social_media_links && (!signals.socials || signals.socials.length === 0)) {
          signals.socials = Object.entries(edgeSignals.social_media_links)
            .filter(([, url]) => url)
            .map(([platform, url]) => ({ platform, url }));
        }
        // Merge AI-extracted identity fields
        if (ex.contact_email && signals.emails?.length === 0) {
          signals.emails = [ex.contact_email];
        }
        if (ex.contact_phone && signals.phones?.length === 0) {
          signals.phones = [ex.contact_phone];
        }
        if (ex.abn && ex.abn !== 'Not available from current data' && !signals.abn) {
          signals.abn = ex.abn;
        }
        if (ex.address && ex.address !== 'Not available from current data' && !signals.address) {
          signals.address = ex.address;
        }
        if (ex.city && !signals.city) signals.city = ex.city;
        if (ex.state && !signals.state) signals.state = ex.state;
        if (ex.trading_name) signals.tradingName = ex.trading_name;

        const abnMeta = await runAbnValidation({
          extractedData: ex,
          edgeSignals,
          website: url,
          currentSignals: signals,
        });
        const mergedSocial = mergeSocialSignals({
          perplexity: ex.social_media_links || {},
          html: edgeSignals.social_media_links || {},
          search: deepEnrichment?.social_handles || {},
        });
        signals.social_enrichment = mergedSocial;
        signals.socials = SOCIAL_PLATFORMS
          .filter((platform) => !!mergedSocial[platform])
          .map((platform) => ({ platform, url: mergedSocial[platform] }));
        signals.abn_verified = abnMeta.abn_verified;
        signals.abn_source = abnMeta.abn_source;
        signals.legal_name = abnMeta.legal_name;
        signals.entity_status = abnMeta.entity_status;
        signals.registered_address = abnMeta.registered_address;
        signals.abn_status = abnMeta.abn_status;
        signals._abnLookupResult = abnMeta._abnLookupResult;
        setAbnValidationResult(abnMeta);
        setIdentitySignals(signals);
        setIdentityConfirmed(false);
        setScanFailure(null);

        await ensureAnalyzeDwell(analyzeStartedAt);
        autoSave(1);
        setEntry("abn_validation");
      } else {
        await ensureAnalyzeDwell(analyzeStartedAt);
        if (edgeScanError) {
          registerScanFailure(getScanFailure(edgeScanError, "WEBSITE_TIMEOUT"), url, attempts);
        } else {
          registerScanFailure(
            getScanFailure(
              { response: { status: 422, data: { code: "INSUFFICIENT_PUBLIC_CONTENT", stage: "scan" } } },
              "INSUFFICIENT_PUBLIC_CONTENT"
            ),
            url,
            attempts
          );
        }
        return;
      }
    } catch (err) {
      await ensureAnalyzeDwell(analyzeStartedAt);
      registerScanFailure(getScanFailure(err), url, attempts);
      return;
    }
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
      setIdentitySignals({
        domain: websiteUrl,
        businessName: '',
        whatYouDo: summary,
        abn_verified: false,
        abn_source: "gud_api",
        legal_name: "",
        entity_status: "",
        registered_address: "",
        abn_status: "not_found",
        social_enrichment: {
          linkedin: "",
          facebook: "",
          instagram: "",
          twitter: "",
          youtube: "",
          source: "search",
          social_status: "not_detected",
        },
      });
      setIdentityConfirmed(false);
      setEntry("abn_validation");
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
    setEntry("wow_cards");
  };

  const handleRegenerateIdentity = async (hints) => {
    setIsRegenerating(true);
    setIdentityConfirmed(false);
    setIdentitySignals(null);
    setEntry("analyzing");

    let url = websiteUrl.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
    const normalizedUrl = url.trim().toLowerCase();
    const attempts = normalizedUrl === lastScanUrl ? scanAttemptCount + 1 : 1;
    setLastScanUrl(normalizedUrl);
    setScanAttemptCount(attempts);
    setScanFailure(null);
    const analyzeStartedAt = Date.now();

    try {
      let auditData = null;
      let deepEnrichment = null;
      let edgeScanError = null;
      let scrapeProfile = null;
      try {
        scrapeProfile = await callEdgeFunction('scrape-business-profile', { url }, 15000);
      } catch {
        // non-fatal in regenerate mode
      }
      {
        try {
          auditData = await callEdgeFunction('calibration-business-dna', {
            website_url: url,
            business_name_hint: hints?.businessName || hints?.legalName || '',
            location_hint: hints?.address || hints?.suburb || '',
            abn_hint: hints?.abn || '',
          }, 90000);
          if (auditData?.status === "error" || auditData?.ok === false || auditData?.error_code) {
            throw {
              response: {
                status: 422,
                data: {
                  code: auditData?.error_code || "UNKNOWN_SCAN_FAILURE",
                  stage: auditData?.stage || "regenerate",
                  details: auditData?.error || "",
                },
              },
            };
          }
        } catch (scanErr) {
          edgeScanError = scanErr;
        }
      }

      try {
        const deepRes = await apiClient.post('/calibration/enrichment/website', { url, action: 'scan' });
        if (deepRes?.data?.enrichment && typeof deepRes.data.enrichment === "object") {
          deepEnrichment = deepRes.data.enrichment;
        }
      } catch {
        // non-fatal in regenerate mode
      }

      const ex =
        auditData?.extracted_data ||
        buildExtractionFromDeepEnrichment(deepEnrichment) ||
        buildExtractionFromScrapeProfile(scrapeProfile, url) ||
        buildExtractionFromUrlFallback(url);
      if (ex) {
            const fullExtraction = {
              ...ex,
              _sources: auditData?.data_sources || [],
              _deep_sources: deepEnrichment?.sources || null,
              _website: url,
              _generated_at: new Date().toISOString(),
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
            setWowSummary(wow);

            const signals = parseIdentitySignals(ex, url);
            const edgeSignals = auditData?.identity_signals || ex._identity_signals || {};
            if (edgeSignals.abn_candidates?.length > 0 && !signals.abn) {
              signals.abn = edgeSignals.abn_candidates[0];
            }
            if (deepEnrichment?.abn && !signals.abn) {
              signals.abn = deepEnrichment.abn;
            }
            if (!signals.abn && Array.isArray(deepEnrichment?.abn_candidates) && deepEnrichment.abn_candidates.length > 0) {
              signals.abn = deepEnrichment.abn_candidates[0];
            }
            if (edgeSignals.phone_numbers?.length > 0 && signals.phones?.length === 0) {
              signals.phones = edgeSignals.phone_numbers;
            }
            if (edgeSignals.email_addresses?.length > 0 && signals.emails?.length === 0) {
              signals.emails = edgeSignals.email_addresses;
            }
            if (edgeSignals.address_candidates?.length > 0 && !signals.address) {
              signals.address = edgeSignals.address_candidates[0];
            }
            if (edgeSignals.geographic_mentions?.length > 0 && !signals.geo) {
              signals.geo = edgeSignals.geographic_mentions.join(', ');
            }
            if (edgeSignals.social_media_links && (!signals.socials || signals.socials.length === 0)) {
              signals.socials = Object.entries(edgeSignals.social_media_links)
                .filter(([, socialUrl]) => socialUrl)
                .map(([platform, socialUrl]) => ({ platform, url: socialUrl }));
            }
            // Merge user hints into signals
            if (hints?.businessName || hints?.legalName) signals.businessName = hints.businessName || hints.legalName || signals.businessName;
            if (hints?.address || hints?.suburb) signals.address = hints.address || hints.suburb || signals.address;
            if (hints?.abn) signals.abn = hints.abn || signals.abn;
            const abnMeta = await runAbnValidation({
              extractedData: ex,
              edgeSignals,
              website: url,
              currentSignals: signals,
            });
            const mergedSocial = mergeSocialSignals({
              perplexity: ex.social_media_links || {},
              html: edgeSignals.social_media_links || {},
              search: deepEnrichment?.social_handles || {},
            });
            signals.social_enrichment = mergedSocial;
            signals.socials = SOCIAL_PLATFORMS
              .filter((platform) => !!mergedSocial[platform])
              .map((platform) => ({ platform, url: mergedSocial[platform] }));
            signals.abn_verified = abnMeta.abn_verified;
            signals.abn_source = abnMeta.abn_source;
            signals.legal_name = abnMeta.legal_name;
            signals.entity_status = abnMeta.entity_status;
            signals.registered_address = abnMeta.registered_address;
            signals.abn_status = abnMeta.abn_status;
            signals._abnLookupResult = abnMeta._abnLookupResult;
            setAbnValidationResult(abnMeta);
            setIdentitySignals(signals);
            await ensureAnalyzeDwell(analyzeStartedAt);
            setEntry("abn_validation");
            setScanFailure(null);
            setIsRegenerating(false);
            return;
      }
      if (edgeScanError) {
        await ensureAnalyzeDwell(analyzeStartedAt);
        registerScanFailure(getScanFailure(edgeScanError, "WEBSITE_TIMEOUT"), url, attempts);
        return;
      }
      await ensureAnalyzeDwell(analyzeStartedAt);
      registerScanFailure(
        getScanFailure(
          { response: { status: 422, data: { code: "INSUFFICIENT_PUBLIC_CONTENT", stage: "regenerate" } } },
          "INSUFFICIENT_PUBLIC_CONTENT"
        ),
        url,
        attempts
      );
      return;
    } catch (err) {
      await ensureAnalyzeDwell(analyzeStartedAt);
      registerScanFailure(getScanFailure(err), url, attempts);
      return;
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
    await new Promise(r => setTimeout(r, 800));
    setIsSubmitting(true);
    try {
      const payload = { step: 2, confirmed_summary: true };
      if (Object.keys(editedFields).length > 0) payload.user_edits = editedFields;
      try { await callEdge(payload); } catch {}

      try {
        const wowToSave = { ...(wowSummary || {}), ...editedFields };
        const full = wowToSave._full || {};
        const cmoBundle = {
          executive_brief: full.cmo_executive_brief || full.executive_summary || '',
          website_health: full.website_health || null,
          seo_analysis: full.seo_analysis || null,
          paid_media_analysis: full.paid_media_analysis || null,
          social_media_analysis: full.social_media_analysis || null,
          swot: full.swot || null,
          competitor_swot: full.competitor_swot || [],
          priority_actions: full.cmo_priority_actions || [],
          competitors: Array.isArray(full.competitors) ? full.competitors : [],
          deep_scan_sources: full.deep_scan_sources || full._deep_sources || null,
        };
        await apiClient.put('/business-profile', {
          business_name: wowToSave.business_name || '',
          mission_statement: wowToSave.what_you_do || full.main_products_services || '',
          target_market: wowToSave.who_you_serve || full.target_market || '',
          industry: full.industry || '',
          website: websiteUrl || full._website || '',
          location: full.location || '',
          abn: wowToSave.abn || full.abn || '',
          main_products_services: full.main_products_services || wowToSave.what_you_do || '',
          unique_value_proposition: full.unique_value_proposition || wowToSave.what_sets_you_apart || '',
          competitive_advantages: full.competitive_advantages || '',
          market_position: full.market_position || '',
          business_model: full.business_model || '',
          pricing_model: full.pricing_model || '',
          sales_cycle_length: full.sales_cycle_length || '',
          customer_count: full.customer_count || '',
          revenue_range: full.revenue_range || '',
          geographic_focus: full.geographic_focus || '',
          growth_strategy: full.growth_strategy || wowToSave.growth_opportunity || '',
          main_challenges: full.main_challenges || wowToSave.biggest_challenges || '',
          social_handles: full.social_media_links || {},
          executive_summary: full.executive_summary || full.cmo_executive_brief || '',
          competitor_scan_result: JSON.stringify(cmoBundle),
        });
      } catch {}

      autoSave(3);
      setTransitioning(false);

      // Go to agent calibration chat (builds personalised AI agent prompt)
      // This happens AFTER the CMO report, BEFORE "Here's What BIQc Found"
      fetchIntelligence();
      setEntry("agent_calibration");
    } catch { setTransitioning(false); setError("Calibration engine temporarily unavailable."); }
    finally { setIsSubmitting(false); }
  };

  const handleAbnValidationContinue = () => {
    const next = getNextCalibrationState("abn_validation");
    if (next) setEntry(next);
  };

  const handleSocialEnrichmentContinue = () => {
    const next = getNextCalibrationState("social_enrichment");
    if (next) setEntry(next);
  };

  const handleContinueWowCards = () => {
    const next = getNextCalibrationState("wow_cards");
    if (next) setEntry(next);
  };

  const handleContinueDeepNarrative = () => {
    const next = getNextCalibrationState("deep_narrative");
    if (next) setEntry(next);
  };

  const handleContinueRoadmap = () => {
    const next = getNextCalibrationState("roadmap");
    if (next) setEntry(next);
  };

  const handleGenerateReportAndContinue = async () => {
    if (!wowSummary?._full) {
      setError("Insufficient verified data");
      return;
    }
    setIsGeneratingReport(true);
    setError(null);
    try {
      const payload = {
        report_type: "deep_cmo",
        wow_full: wowSummary._full,
        identity_signals: identitySignals || {},
      };
      const report = await apiClient.post("/reports/generate-pdf", payload);
      setDeepCmoReport(report?.data || null);
      try {
        const history = await apiClient.get("/reports/deep-cmo/history");
        setDeepCmoReportHistory(history?.data?.items || []);
      } catch {}
      setEntry("wow_summary");
    } catch (e) {
      setError(e?.response?.data?.detail || "Insufficient verified data");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // ═══ PHASE 4c: Agent Calibration Complete → Show Intelligence Snapshot ═══
  const handleAgentCalibrationComplete = () => {
    autoSave(4);
    setEntry("integration_connect");
  };

  // ═══ PHASE 5: Snapshot → Dashboard ═══
  const proceedFromIntelligence = async () => {
    await autoSave(9, "COMPLETE");
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
    await autoSave(9, "COMPLETE");
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
      if (data.status === "COMPLETE") { await autoSave(9, "COMPLETE"); triggerComplete(); return; }
      if (currentStep >= 9) { await autoSave(9, "COMPLETE"); triggerComplete(); return; }
      autoSave(currentStep, "IN_PROGRESS");
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
      if (data.status === "COMPLETE") { await autoSave(9, "COMPLETE"); triggerComplete(); return; }
      if (data.question && data.options?.length > 0) { applyResponse(data); return; }
      if (data.message) {
        setMessages(prev => [...prev, { role: "edge", text: data.message }]);
        const hasQuestion = data.message.includes('?');
        if (!hasQuestion) {
          try {
            const nextStep = Math.min(currentStep + 2, 9);
            const followUp = await callEdge({ step: nextStep, message: "continue" });
            if (followUp.status === "COMPLETE") { await autoSave(9, "COMPLETE"); triggerComplete(); return; }
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
      const data = await callEdgeFunction('biqc-insights-cognitive', {});
      if (data) {
        setIntelligenceData(data);
      }
    } catch {}
  };

  // ABN Registry Lookup — calls business-identity-lookup Edge Function
  const handleAbnLookup = async (lookupParams) => {
    try {
      const data = await callEdgeFunction('business-identity-lookup', lookupParams || {});
      if (data) {
        if (data.status === 'found' || data.status === 'ambiguous') {
          const abnStatus = data.status === "found" ? "verified" : "multiple";
          // Merge lookup results into identity signals
          setIdentitySignals(prev => ({
            ...prev,
            businessName: data.legal_name || prev?.businessName || '',
            tradingName: data.trading_name || prev?.tradingName || '',
            abn: data.abn || prev?.abn || '',
            address: data.address || prev?.address || '',
            state: data.address_state || prev?.state || '',
            abn_verified: data.status === "found",
            abn_source: "gud_api",
            legal_name: data.legal_name || prev?.legal_name || "",
            entity_status: data.entity_status || prev?.entity_status || "",
            registered_address: data.address || prev?.registered_address || "",
            abn_status: abnStatus,
            _abnLookupResult: data,
          }));
        } else if (data.status === "not_found") {
          setIdentitySignals(prev => ({
            ...prev,
            abn_verified: false,
            abn_source: "gud_api",
            abn_status: "not_found",
            _abnLookupResult: data,
          }));
        }
        return data;
      }
    } catch (e) {
      console.warn('[calibration] ABN lookup failed:', e);
    }
    return null;
  };

  return {
    entry, setEntry, user, loading, firstName, userEmail, websiteUrl, setWebsiteUrl,
    wowSummary, editedFields, editingKey, editValue, setEditValue,
    isSubmitting, error, transitioning, revealPhase, lastResponse,
    calStep, calMode, question, options, allowText, insight,
    selectedOption, setSelectedOption, textValue, setTextValue,
    messages, inputValue, setInputValue,
    currentStep, intelligenceData, fetchIntelligence, proceedFromIntelligence,
    scanFailure, scanAttemptCount, canManualFallback,
    deepCmoReport, deepCmoReportHistory, isGeneratingReport, abnValidationResult,
    // Identity verification
    identitySignals, identityConfirmed, identityConfidence, isRegenerating,
    handleConfirmIdentity, handleRegenerateIdentity, handleRejectIdentity, handleAbnLookup,
    handleSignOut, handleAuditSubmit, handleManualSummary,
    handleConfirmWow,
    handleAbnValidationContinue, handleSocialEnrichmentContinue,
    handleContinueWowCards, handleContinueDeepNarrative, handleContinueRoadmap,
    handleGenerateReportAndContinue,
    handleAgentCalibrationComplete, callEdge,
    startEdit, commitEdit,
    startCalibration, handleWizardContinue, handleChatSubmit,
  };
};
