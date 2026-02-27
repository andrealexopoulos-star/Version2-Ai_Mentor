/**
 * BIQc API Client — React Native
 * Points to same backend as web app.
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// TODO: Update to production URL
const API_URL = 'https://biqc.thestrategysquad.com/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('access_token');
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth helpers
export const auth = {
  async login(email: string, password: string) {
    const res = await api.post('/auth/supabase/login', { email, password });
    if (res.data?.access_token) {
      await SecureStore.setItemAsync('access_token', res.data.access_token);
      await SecureStore.setItemAsync('user', JSON.stringify(res.data.user || {}));
    }
    return res.data;
  },

  async logout() {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('user');
  },

  async getToken() {
    return await SecureStore.getItemAsync('access_token');
  },

  async getUser() {
    const user = await SecureStore.getItemAsync('user');
    return user ? JSON.parse(user) : null;
  },

  async isAuthenticated() {
    const token = await SecureStore.getItemAsync('access_token');
    return !!token;
  },
};
