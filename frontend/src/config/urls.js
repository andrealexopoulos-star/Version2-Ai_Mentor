/**
 * URL CONFIGURATION - SINGLE SOURCE OF TRUTH
 * 
 * This module provides fork-safe URL resolution across the entire application.
 * ALL URL construction MUST use these functions to ensure fork independence.
 * 
 * CRITICAL: Never hardcode preview URLs anywhere in the codebase.
 */

/**
 * Get the canonical base URL for this application instance
 * This is fork-safe and automatically adapts to any preview environment
 */
export const getAppBaseUrl = () => {
  // In production, this would be the deployed domain
  // In preview/fork environments, this is the current origin
  return window.location.origin;
};

/**
 * Get the backend API base URL
 * ALWAYS uses the current page origin — this ensures API calls go to the
 * same domain the page is loaded from, which has proper /api proxy routing.
 * 
 * CRITICAL: process.env.REACT_APP_BACKEND_URL is baked at BUILD TIME by webpack.
 * In production, the build happens in the preview container, so it contains the
 * PREVIEW URL, not the production URL. Using it would send API calls to the
 * wrong server. window.location.origin is ALWAYS correct.
 */
export const getBackendUrl = () => {
  const backendUrl = (process.env.REACT_APP_BACKEND_URL || '').trim();

  // On Azure frontend hosts, prefer explicit backend URL wiring.
  // This avoids drifting to an unrelated same-origin /api upstream.
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname.toLowerCase();
    if (host.endsWith('.azurewebsites.net') && backendUrl) {
      return backendUrl.replace(/\/$/, '');
    }
  }

  // In deployed environments, always prefer the current origin (/api reverse-proxy)
  // to avoid stale build-time backend URLs causing 401/404 mismatches.
  if (typeof window !== 'undefined' && window.location?.origin) {
    if (window.location.hostname !== 'localhost') {
      return window.location.origin.replace(/\/$/, '');
    }
  }

  if (backendUrl) return backendUrl.replace(/\/$/, '');

  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') return 'http://localhost:8000';
  throw new Error('Unable to resolve backend URL');
};

/**
 * Get the full API endpoint URL
 */
export const getApiBaseUrl = () => {
  return `${getBackendUrl()}/api`;
};

/**
 * Get OAuth redirect URL for Supabase authentication
 */
export const getOAuthRedirectUrl = () => {
  return `${getAppBaseUrl()}/auth/callback`;
};

/**
 * Get Supabase configuration
 */
export const getSupabaseConfig = () => {
  return {
    url: process.env.REACT_APP_SUPABASE_URL,
    anonKey: process.env.REACT_APP_SUPABASE_ANON_KEY
  };
};

/**
 * URL validation - ensures no legacy URLs are being used
 */
export const isLegacyUrl = (url) => {
  const legacyPatterns = [
    /advisor-chat-\d+/,
    /business-iq-\d+/
  ];
  
  return legacyPatterns.some(pattern => pattern.test(url));
};

/**
 * Assert that a URL is not a legacy fork URL
 * Throws error in development to catch hardcoded URLs early
 */
export const assertNotLegacyUrl = (url) => {
  if (isLegacyUrl(url)) {
    const error = `LEGACY URL DETECTED: ${url}. Use getAppBaseUrl() instead of hardcoding.`;
    console.error(error);
    if (process.env.NODE_ENV === 'development') {
      throw new Error(error);
    }
  }
};

// Lazy so getBackendUrl() isn't called at module load (e.g. during build when window is undefined)
export const URL_CONFIG = {
  get APP_BASE() { return getAppBaseUrl(); },
  get BACKEND() { return getBackendUrl(); },
  get API() { return getApiBaseUrl(); },
  get OAUTH_REDIRECT() { return getOAuthRedirectUrl(); },
  get SUPABASE() { return getSupabaseConfig(); },
};

export default URL_CONFIG;
