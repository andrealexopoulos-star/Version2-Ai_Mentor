import axios from 'axios';
import { supabase } from '../context/SupabaseAuthContext';

export const API_BASE = process.env.REACT_APP_BACKEND_URL
  ? `${process.env.REACT_APP_BACKEND_URL}/api`
  : '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Request interceptor — Supabase session token + cache-busting on ALL requests
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
  
  // ALWAYS add cache-busting headers + accept JSON
  config.headers = config.headers || {};
  config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  config.headers['Pragma'] = 'no-cache';
  config.headers['Accept'] = 'application/json';
  
  // Add cache-busting query param to bypass CDN/proxy caching
  config.params = config.params || {};
  config.params._t = Date.now();
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor — detect HTML responses and auto-retry
apiClient.interceptors.response.use(
  async (response) => {
    const ct = response.headers?.['content-type'] || '';
    const apiServer = response.headers?.['x-api-server'];
    
    // If response has X-API-Server header, it came from our backend — trust it
    if (apiServer) return response;
    
    if (ct.includes('text/html') && !response.config?._htmlRetried) {
      console.warn(`[apiClient] HTML response for ${response.config?.url} — killing SW and retrying`);
      
      // Kill service workers and caches
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

      // Retry with fresh cache-busting timestamp
      const retryConfig = {
        ...response.config,
        _htmlRetried: true,
        params: { ...response.config.params, _t: Date.now() },
        headers: {
          ...response.config.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      };
      return apiClient.request(retryConfig);
    }
    
    // Still HTML after retry — reject with clear error
    if (ct.includes('text/html')) {
      console.error(`[apiClient] STILL HTML after retry for ${response.config?.url}`);
      return Promise.reject(new Error(`API returned HTML instead of JSON for ${response.config?.url}`));
    }
    
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);
