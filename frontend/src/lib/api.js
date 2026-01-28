import axios from 'axios';
import { supabase } from '../context/SupabaseAuthContext';

export const API_BASE = process.env.REACT_APP_BACKEND_URL
  ? `${process.env.REACT_APP_BACKEND_URL}/api`
  : '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // 30 second timeout
});

// Request interceptor - add auth token (supports both MongoDB and Supabase)
apiClient.interceptors.request.use(async (config) => {
  // First try to get Supabase session token
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${session.access_token}`;
      return config;
    }
  } catch (error) {
    console.log('No Supabase session, checking MongoDB token...');
  }
  
  // Fallback to MongoDB token
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor - handle auth errors (DISABLED for stability)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't auto-redirect on 401 - let components handle auth errors
    // This prevents logout loops from non-critical API calls
    return Promise.reject(error);
  }
);
