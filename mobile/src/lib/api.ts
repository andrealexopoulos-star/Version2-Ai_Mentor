/**
 * BIQc API Client — React Native
 * Connects to the same backend as the web app.
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://beta.thestrategysquad.com/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
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
    const u = await SecureStore.getItemAsync('user');
    return u ? JSON.parse(u) : null;
  },
  async isAuthenticated() {
    const token = await SecureStore.getItemAsync('access_token');
    return !!token;
  },
};
