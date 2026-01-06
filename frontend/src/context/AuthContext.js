import { createContext, useContext, useState, useEffect } from 'react';
import { apiClient, API_BASE } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await apiClient.get(`/auth/me`);
      setUser(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Auth error:', error);
      // Clear invalid token
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await apiClient.post(`/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      return userData;
    } catch (error) {
      // Clear any stale token
      localStorage.removeItem('token');
      setToken(null);
      throw error;
    }
  };

  const register = async (data) => {
    try {
      const response = await apiClient.post(`/auth/register`, data);
      const { access_token, user: userData } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      return userData;
    } catch (error) {
      // Clear any stale token
      localStorage.removeItem('token');
      setToken(null);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const isAdmin = () => user?.role === 'admin';

  const refreshUser = async () => {
    try {
      const response = await apiClient.get(`/auth/me`);
      setUser(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAdmin, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
