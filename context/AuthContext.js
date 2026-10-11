import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../services/storage';
import socketService from '../services/socket';
import { setUnauthorizedCallback, setIsLoggingOutState } from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStorageData();
    
    // Register unauthorized callback to log out user automatically on 401
    setUnauthorizedCallback(() => {
      console.log('🔐 AuthContext: Unauthorized 401 received. Automatically logging out...');
      logout();
    });
    
    return () => {
      setUnauthorizedCallback(null);
    };
  }, []);

  async function loadStorageData() {
    try {
      const userData = await storage.getItem('userData');
      const token = await storage.getItem('userToken');
      
      if (userData && token) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        
        // Auto-connect socket for persistent login session
        console.log(`🔐 AuthContext: Auto-connecting socket for persistent login: ${parsedUser.name}`);
        await socketService.connect();
      }
    } catch (e) {
      console.error('Failed to load storage data in AuthProvider:', e);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Log in user, write token/data to SecureStore, and connect live socket
   */
  const login = async (userData, token) => {
    console.log("first")
    try {
      await storage.setItem('userToken', token);
      await storage.setItem('userData', JSON.stringify(userData));
      setUser(userData);
      
      console.log(`🔐 AuthContext: Login successful. Initiating socket for ${userData.name}`);
      await socketService.connect();
    } catch (err) {
      console.error('Failed to execute login sequence:', err);
      throw err;
    }
  };

  /**
   * Log out user, purge SecureStore, and disconnect socket gracefully
   */
  const logout = async () => {
    try {
      console.log('🔐 AuthContext: Initiating logout sequence...');
      setIsLoggingOutState(true);
      
      // Stop tracking if active before cleaning tokens
      try {
        const activeSession = await storage.getItem('currentTrackingSessionId');
        if (activeSession) {
          console.log('🔐 AuthContext: Active tracking session detected on logout. Cleaning...');
          const { stopTracking } = require('../hooks/useLocationTracker');
          // Non-blocking fallback to clean location tasks
          await storage.removeItem('currentTrackingSessionId');
        }
      } catch {}

      socketService.disconnect();
      await storage.removeItem('userToken');
      await storage.removeItem('token');
      await storage.removeItem('userData');
      await storage.removeItem('user');
      setUser(null);
    } catch (err) {
      console.error('Failed to execute logout sequence:', err);
    } finally {
      setTimeout(() => {
        setIsLoggingOutState(false);
      }, 2500);
    }
  };

  /**
   * Helper to sync modified user profile details
   */
  const updateUser = async (updatedData) => {
    try {
      const mergedUser = { ...user, ...updatedData };
      await storage.setItem('userData', JSON.stringify(mergedUser));
      setUser(mergedUser);
      console.log('🔐 AuthContext: Profile values updated successfully.');
    } catch (err) {
      console.error('Failed to merge updated user data:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
