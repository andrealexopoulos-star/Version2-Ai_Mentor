import axios from 'axios';
import { supabase } from '../context/SupabaseAuthContext';

export const API_BASE = process.env.REACT_APP_BACKEND_URL
  ? `${process.env.REACT_APP_BACKEND_URL}/api`
  : '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Request interceptor — Supabase session token only
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
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor — detect HTML responses and auto-retry once
// Root cause: stale service worker cache returns HTML for API calls
apiClient.interceptors.response.use(
  async (response) => {
    const ct = response.headers?.['content-type'] || '';
    if (ct.includes('text/html') && !response.config?._htmlRetried) {
      console.warn(`[apiClient] HTML response for ${response.config?.url} — retrying direct`);
      
      // Force clear any remaining service worker caches
      if ('caches' in window) {
        try {
          const names = await caches.keys();
          await Promise.all(names.map(n => caches.delete(n)));
        } catch {}
      }

      // Retry the request once with cache-busting headers
      const retryConfig = {
        ...response.config,
        _htmlRetried: true,
        headers: {
          ...response.config.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      };
      return apiClient.request(retryConfig);
    }
    
    // Still HTML after retry — reject
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
