import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api.service';
import { initSocket, disconnectSocket } from '../services/socket.service';
import toast from 'react-hot-toast';

const AuthContext = createContext();

const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000;
let tokenRefreshInterval = null;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [organization, setOrganization] = useState(() => {
    try {
      const saved = localStorage.getItem('organization');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(localStorage.getItem('token')));
  const [authError, setAuthError] = useState(null);

  const refreshTokenIfNeeded = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return;

    try {
      const { data } = await authAPI.refreshToken(refreshToken);
      if (data.token) {
        localStorage.setItem('token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        if (data.user) {
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        if (data.organization) {
          setOrganization(data.organization);
          localStorage.setItem('organization', JSON.stringify(data.organization));
        }
      }
    } catch (err) {
      console.warn('Silent token refresh failed:', err.message);
    }
  }, []);

  const setupTokenRefresh = useCallback(() => {
    if (tokenRefreshInterval) clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = setInterval(refreshTokenIfNeeded, TOKEN_REFRESH_INTERVAL);
  }, [refreshTokenIfNeeded]);

  const clearTokenRefresh = useCallback(() => {
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval);
      tokenRefreshInterval = null;
    }
  }, []);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await authAPI.getMe();
      setUser(data.user);
      if (data.organization) {
        setOrganization(data.organization);
        localStorage.setItem('organization', JSON.stringify(data.organization));
      }
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(data.user));
      initSocket(token);
      setupTokenRefresh();
      setAuthError(null);
    } catch (err) {
      console.error('Auth error:', err);
      // Attempt silent refresh before logging out
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data: refreshData } = await authAPI.refreshToken(refreshToken);
          if (refreshData.token) {
            localStorage.setItem('token', refreshData.token);
            if (refreshData.refreshToken) localStorage.setItem('refreshToken', refreshData.refreshToken);
            setUser(refreshData.user);
            setIsAuthenticated(true);
            initSocket(refreshData.token);
            setupTokenRefresh();
            setAuthError(null);
            setLoading(false);
            return;
          }
        } catch (e) {
          // Token refresh failed
        }
      }

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('organization');
      setUser(null);
      setOrganization(null);
      setIsAuthenticated(false);
      setAuthError(err.response?.data?.message || 'Auth failed');
    } finally {
      setLoading(false);
    }
  }, [setupTokenRefresh]);

  useEffect(() => {
    loadUser();
    return () => clearTokenRefresh();
  }, [loadUser, clearTokenRefresh]);

  const login = async (email, password) => {
    try {
      setAuthError(null);
      const { data } = await authAPI.login({ email, password });

      if (data.user.isBlocked) {
        setAuthError('Account has been blocked');
        toast.error('❌ Account blocked by admin');
        return { success: false };
      }

      localStorage.setItem('token', data.token);
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      if (data.organization) {
        setOrganization(data.organization);
        localStorage.setItem('organization', JSON.stringify(data.organization));
      }
      setIsAuthenticated(true);
      initSocket(data.token);
      setupTokenRefresh();

      toast.success(`Welcome back, ${data.user.name.split(' ')[0]}! 👋`);
      return { success: true, role: data.user.role };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setAuthError(message);
      toast.error(`❌ ${message}`);
      return { success: false };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.warn('Logout API error:', err);
    }

    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('organization');
    localStorage.removeItem('isTracking');
    localStorage.removeItem('sessionId');
    disconnectSocket();
    clearTokenRefresh();
    setUser(null);
    setOrganization(null);
    setIsAuthenticated(false);
    setAuthError(null);
    toast.success('Logged out successfully');
  };

  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const updateOrganization = (updates) => {
    setOrganization((prev) => {
      const updated = { ...(prev || {}), ...updates };
      localStorage.setItem('organization', JSON.stringify(updated));
      return updated;
    });
  };

  const registerOrganization = async (formData) => {
    try {
      setAuthError(null);
      const { data } = await authAPI.registerOrganization(formData);
      if (data.token) {
        localStorage.setItem('token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        if (data.organization) {
          setOrganization(data.organization);
          localStorage.setItem('organization', JSON.stringify(data.organization));
        }
        setIsAuthenticated(true);
        initSocket(data.token);
        setupTokenRefresh();
        toast.success(`Welcome to TrackPro! ${data.organization.name} registered 🎉`);
        return { success: true };
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Organization registration failed';
      setAuthError(message);
      toast.error(`❌ ${message}`);
      return { success: false, message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        loading,
        isAuthenticated,
        authError,
        login,
        logout,
        registerOrganization,
        updateUser,
        updateOrganization,
        loadUser,
        refreshUser: loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
