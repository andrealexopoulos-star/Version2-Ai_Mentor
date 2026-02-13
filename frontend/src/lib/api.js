import axios from 'axios';
import { supabase } from '../context/SupabaseAuthContext';
import { getBackendUrl } from '../config/urls';

// BULLETPROOF: Use centralized URL resolver — falls back to window.location.origin
// if REACT_APP_BACKEND_URL is missing, empty, or malformed (no https://)
export const API_BASE = `${getBackendUrl()}/api`;

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// LAYER 2: Cache-busting on every request
apiClient.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (error) {
    console.warn('Failed to get Supabase session:', error.message);
  }
  
  config.headers = config.headers || {};
  config.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
  config.headers['Pragma'] = 'no-cache';
  config.headers['Expires'] = '0';
  config.headers['Accept'] = 'application/json';
  config.params = config.params || {};
  config.params._t = Date.now();
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// LAYER 3: HTML detection + hard reload fail-safe
const RELOAD_FLAG = 'biqc_cache_kill_reload';

apiClient.interceptors.response.use(
  async (response) => {
    const ct = response.headers?.['content-type'] || '';
    
    if (response.headers?.['x-api-server']) return response;
    
    if (ct.includes('text/html')) {
      const url = response.config?.url || 'unknown';
      console.error('%c CRITICAL: API returned HTML for ' + url, 'color:red;font-weight:bold;font-size:14px');
      
      if ('serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        } catch {}
      }
      if ('caches' in window) {
        try {
          const names = await caches.keys();
          await Promise.all(names.map(n => caches.delete(n)));
        } catch {}
      }
      
      const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG);
      if (!alreadyReloaded) {
        sessionStorage.setItem(RELOAD_FLAG, Date.now().toString());
        console.error('%c HARD RELOAD to break zombie state', 'color:red;font-weight:bold;font-size:16px');
        window.location.reload(true);
        return new Promise(() => {});
      }
      
      sessionStorage.removeItem(RELOAD_FLAG);
      return Promise.reject(new Error(`API returned HTML instead of JSON for ${url}`));
    }
    
    if (sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.removeItem(RELOAD_FLAG);
    }
    
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);
