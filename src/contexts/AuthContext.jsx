import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api.service';
import { initSocket, disconnectSocket } from '../services/socket.service';
import toast from 'react-hot-toast';

const AuthContext = createContext();

const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // Refresh token every 5 minutes
let tokenRefreshInterval = null;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(null);

  /**
   * Refresh token before expiry
   */
  const refreshTokenIfNeeded = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const { data } = await authAPI.refreshToken?.() || Promise.reject(new Error('Refresh not available'));
      if (data.token) {
        localStorage.setItem('token', data.token);
        if (data.user) setUser(data.user);
      }
    } catch (err) {
      console.warn('Token refresh failed:', err.message);
      // Will be handled by API interceptor on next request
    }
  }, []);

  /**
   * Setup token refresh interval
   */
  const setupTokenRefresh = useCallback(() => {
    if (tokenRefreshInterval) clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = setInterval(refreshTokenIfNeeded, TOKEN_REFRESH_INTERVAL);
  }, [refreshTokenIfNeeded]);

  /**
   * Clear token refresh interval
   */
  const clearTokenRefresh = useCallback(() => {
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval);
      tokenRefreshInterval = null;
    }
  }, []);

  /**
   * Load user from localStorage and verify token
   */
  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await authAPI.getMe();
      setUser(data.user);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(data.user));
      initSocket(token);
      setupTokenRefresh();
      setAuthError(null);
    } catch (err) {
      console.error('Auth error:', err);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(err.response?.data?.message || 'Auth failed');
    } finally {
      setLoading(false);
    }
  }, [setupTokenRefresh]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    loadUser();
    return () => clearTokenRefresh();
  }, [loadUser, clearTokenRefresh]);

  /**
   * Login
   */
  const login = async (email, password) => {
    try {
      setAuthError(null);
      const { data } = await authAPI.login({ email, password });

      if (!data.user.isApproved) {
        setAuthError('Account pending admin approval');
        toast.error('❌ Account pending admin approval');
        return { success: false };
      }

      if (data.user.isBlocked) {
        setAuthError('Account has been blocked');
        toast.error('❌ Account blocked by admin');
        return { success: false };
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setIsAuthenticated(true);
      initSocket(data.token);
      setupTokenRefresh();

      toast.success(`Welcome back, ${data.user.name.split(' ')[0]}! 👋`);
      return { success: true, role: data.user.role };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setAuthError(message);
      toast.error(message);
      return { success: false };
    }
  };

  /**
   * Logout
   */
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.warn('Logout API error:', err);
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectSocket();
    clearTokenRefresh();
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    toast.success('Logged out successfully');
  };

  /**
   * Update user locally
   */
  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        authError,
        login,
        logout,
        updateUser,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
