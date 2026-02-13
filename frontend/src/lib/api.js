import axios from 'axios';
import { supabase } from '../context/SupabaseAuthContext';

export const API_BASE = process.env.REACT_APP_BACKEND_URL
  ? `${process.env.REACT_APP_BACKEND_URL}/api`
  : '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// ═══════════════════════════════════════════════════════════════
// OPERATION "CACHE KILL" — LAYER 2: THE ARMOR
// Every request gets cache-busting headers AND timestamp param.
// ═══════════════════════════════════════════════════════════════
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
  
  // ARMOR: Cache-busting on every single request
  config.headers = config.headers || {};
  config.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
  config.headers['Pragma'] = 'no-cache';
  config.headers['Expires'] = '0';
  config.headers['Accept'] = 'application/json';
  
  // Timestamp busting: append ?_t=<timestamp> to bypass ALL caching layers
  config.params = config.params || {};
  config.params._t = Date.now();
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// ═══════════════════════════════════════════════════════════════
// OPERATION "CACHE KILL" — LAYER 3: THE RETRY GUARD
// If HTML is detected, kill SW and force hard reload ONCE.
// Uses sessionStorage to prevent infinite reload loops.
// ═══════════════════════════════════════════════════════════════
const RELOAD_FLAG = 'biqc_cache_kill_reload';

apiClient.interceptors.response.use(
  async (response) => {
    const ct = response.headers?.['content-type'] || '';
    
    // If response has our backend marker, it's genuine — trust it
    if (response.headers?.['x-api-server']) return response;
    
    // CRITICAL: HTML detected on an API call
    if (ct.includes('text/html')) {
      const url = response.config?.url || 'unknown';
      console.error(
        '%c CRITICAL: API returned HTML. Service Worker Poisoning detected.',
        'color: red; font-weight: bold; font-size: 14px',
        url
      );
      
      // Kill all service workers immediately
      if ('serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
          console.log('%c Emergency SW kill executed', 'color: orange; font-weight: bold');
        } catch {}
      }
      
      // Nuke all caches
      if ('caches' in window) {
        try {
          const names = await caches.keys();
          await Promise.all(names.map(n => caches.delete(n)));
        } catch {}
      }
      
      // LAYER 3 FAIL-SAFE: Force hard reload ONCE to break zombie state
      const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG);
      if (!alreadyReloaded) {
        sessionStorage.setItem(RELOAD_FLAG, Date.now().toString());
        console.error(
          '%c EXECUTING HARD RELOAD to break Service Worker Poisoning',
          'color: red; font-weight: bold; font-size: 16px'
        );
        window.location.reload(true);
        // Execution stops here — page reloads
        return new Promise(() => {}); // Never resolves
      }
      
      // Already reloaded once — don't loop. Clear flag for next session.
      sessionStorage.removeItem(RELOAD_FLAG);
      
      // Reject with clear error
      return Promise.reject(
        new Error(`API returned HTML instead of JSON for ${url}. Service Worker killed. Please refresh manually if issue persists.`)
      );
    }
    
    // Valid JSON response — clear reload flag if it exists
    if (sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.removeItem(RELOAD_FLAG);
    }
    
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);
