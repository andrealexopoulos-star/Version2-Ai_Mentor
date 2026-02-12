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

// Response interceptor — reject HTML responses (service worker / proxy misrouting)
apiClient.interceptors.response.use(
  (response) => {
    const ct = response.headers?.['content-type'] || '';
    if (ct.includes('text/html') && !response.config?.expectHtml) {
      console.warn(`[apiClient] Got HTML instead of JSON for ${response.config?.url}`);
      return Promise.reject(new Error('Received HTML instead of JSON'));
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);
