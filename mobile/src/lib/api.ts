/**
 * BIQc Mobile — API Client
 * Thin client — consumes existing backend APIs only.
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.biqc.ai/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('user');
    }
    return Promise.reject(error);
  }
);

export default api;

export const auth = {
  async login(email: string, password: string) {
    const res = await api.post('/auth/supabase/login', { email, password });
    // Backend returns session.access_token
    const token = res.data?.session?.access_token || res.data?.access_token;
    const refreshToken = res.data?.session?.refresh_token || null;
    if (token) {
      await SecureStore.setItemAsync('access_token', token);
      if (refreshToken) await SecureStore.setItemAsync('refresh_token', refreshToken);
      await SecureStore.setItemAsync('user', JSON.stringify(res.data.user || {}));
    }
    return res.data;
  },
  async logout() {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user');
  },
  async getToken() {
    return await SecureStore.getItemAsync('access_token');
  },
  async getUser() {
    const u = await SecureStore.getItemAsync('user');
    return u ? JSON.parse(u) : null;
  },
  async isAuthenticated() {
    const token = await SecureStore.getItemAsync('access_token');
    return !!token;
  },
};
