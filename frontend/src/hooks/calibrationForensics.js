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

