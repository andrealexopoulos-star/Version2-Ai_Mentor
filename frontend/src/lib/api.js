import axios from 'axios';
import { supabase } from '../context/SupabaseAuthContext';
import { getBackendUrl } from '../config/urls';

export const API_BASE = `${getBackendUrl()}/api`;

// --- Cached auth token (Problem 1 fix) ---
// Instead of calling supabase.auth.getSession() on every request,
// cache the token and update it only when auth state changes.
let cachedAccessToken = null;

supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token || null;
});

// Initialize from current session
supabase.auth.getSession().then(({ data: { session } }) => {
  cachedAccessToken = session?.access_token || null;
});

const devBypassAuth =
  typeof process !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  (process.env.REACT_APP_DEV_BYPASS_AUTH === '1' || process.env.REACT_APP_DEV_BYPASS_AUTH === 'true');
const devBypassSecret =
  (typeof process !== 'undefined' && process.env.REACT_APP_DEV_BYPASS_SECRET) || 'dev-bypass-local';

const getCalibrationQaKey = () => {
  try {
    if (typeof window === 'undefined') return '';
    const pathname = window.location?.pathname || '';
    if (pathname !== '/calibration-qa') return '';
    return (sessionStorage.getItem('biqc_calibration_qa_key') || '').trim();
  } catch {
    return '';
  }
};

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  if (devBypassAuth && devBypassSecret) {
    config.headers['X-Dev-Bypass'] = devBypassSecret;
  }
  const qaBypassKey = getCalibrationQaKey();
  if (qaBypassKey) {
    config.headers['X-QA-Bypass'] = qaBypassKey;
  }

  // Use cached token instead of per-request getSession() call
  if (cachedAccessToken) {
    config.headers.Authorization = `Bearer ${cachedAccessToken}`;
  }

  config.headers['Accept'] = 'application/json';

  return config;
}, (error) => {
  return Promise.reject(error);
});

apiClient.interceptors.response.use(
  (response) => {
    const ct = response.headers?.['content-type'] || '';

    if (response.headers?.['x-api-server']) return response;

    if (ct.includes('text/html')) {
      const url = response.config?.url || 'unknown';
      if (process.env.NODE_ENV !== 'production') console.error('[apiClient] API returned HTML for', url);
      return Promise.reject(new Error(`API returned HTML instead of JSON for ${url}`));
    }

    return response;
  },
  async (error) => {
    const config = error.config;
    const status = error.response?.status;

    // Retry once on 502/503 (transient server errors) with 2s delay
    if ((status === 502 || status === 503) && !config._retried) {
      config._retried = true;
      await new Promise(r => setTimeout(r, 2000));
      return apiClient(config);
    }

    // Auto-retry once on 401 with a refreshed token
    if (status === 401 && !config._retried) {
      config._retried = true;
      return supabase.auth.refreshSession().then(({ data }) => {
        if (data?.session?.access_token) {
          cachedAccessToken = data.session.access_token;
          config.headers.Authorization = `Bearer ${data.session.access_token}`;
          return apiClient.request(config);
        }
        return Promise.reject(error);
      }).catch(() => Promise.reject(error));
    }
    return Promise.reject(error);
  }
);

export const callEdgeFunction = async (functionName, payload = {}, timeout = 45000, trace = {}) => {
  const refreshAuthSessionOnce = async () => {
    try {
      const { data } = await supabase.auth.refreshSession();
      return data?.session?.access_token || '';
    } catch {
      return '';
    }
  };
  const headers = {};
  if (trace?.runId) headers['X-Calibration-Run-Id'] = trace.runId;
  if (trace?.step) headers['X-Calibration-Step'] = trace.step;

  const invoke = async (extraHeaders = {}) => (
    apiClient.post(
      `/edge/functions/${encodeURIComponent(functionName)}`,
      { payload },
      {
        timeout,
        headers: { ...headers, ...extraHeaders },
        // Preserve edge/proxy HTTP truth and handle it in this wrapper.
        validateStatus: () => true,
      }
    )
  );

  let response = await invoke();
  let data = response.data;
  if (!data || typeof data !== 'object') {
    data = {};
  }
  if (!data._http_status) {
    data._http_status = Number(response.status || 0);
  }

  // Retry once if proxy/edge reports unauthorized via status or envelope.
  const errorText = String(data?.error || data?.detail || '').toLowerCase();
  const errorCode = String(data?.code || '').toLowerCase();
  const embeddedStatus = Number(data?._http_status || response.status || 0);
  const isUnauthorizedEnvelope =
    (
      response.status === 401 ||
      embeddedStatus === 401 ||
      errorCode.includes('unauthorized') ||
      errorText.includes('unauthorized')
    );

  if (isUnauthorizedEnvelope) {
    const freshToken = await refreshAuthSessionOnce();
    if (freshToken) {
      response = await invoke({ Authorization: `Bearer ${freshToken}` });
      data = response.data;
      if (!data || typeof data !== 'object') {
        data = {};
      }
      if (!data._http_status) {
        data._http_status = Number(response.status || 0);
      }
    }
  }

  return data;
};
