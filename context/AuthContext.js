import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform, DeviceEventEmitter } from 'react-native';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { storage } from '../services/storage';
import socketService from '../services/socket';
import { setUnauthorizedCallback, setIsLoggingOutState } from '../services/api';
import { BACKGROUND_TRACKING_TASK, stopHeartbeat } from '../services/locationTask';

const isExpoGo = Constants.appOwnership === 'expo';

const TRACKING_STORAGE_KEYS = [
  'currentTrackingSessionId',
  'tracking_accumulated_session_id',
  'isTrackingActive',
  'trackingStartTime',
  'tracking_accumulated_distance',
  'last_recorded_location',
  'last_gps_received_at',
  'last_heartbeat_ts',
  'last_server_upload_event_id',
  'passive_motion_first_seen',
  'passive_motion_last_seen',
  'passive_motion_start_coords',
  'passive_last_lat',
  'passive_last_lng',
  'passive_last_time',
  'tracking_screen_coord_outbox',
  'tracking_session_checkpoint',
  'offline_request_queue',
  'offline_retry_counts',
  'cache_emp_dashboard_v1',
];

async function purgeLocalTrackingState() {
  try {
    stopHeartbeat();
    if (Platform.OS !== 'web' && !isExpoGo) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => {});
    }
    await Promise.all(TRACKING_STORAGE_KEYS.map((k) => storage.removeItem(k).catch(() => {})));
    DeviceEventEmitter.emit('TrackingStateChanged', false);
  } catch (_) {}
}

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
        const userId = String(parsedUser?._id || parsedUser?.id || '');
        const ownerId = await storage.getItem('trackingOwnerUserId');
        if (userId && ownerId && ownerId !== userId) {
          await purgeLocalTrackingState();
        }
        if (userId) {
          await storage.setItem('trackingOwnerUserId', userId);
        }
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
    try {
      const newUserId = String(userData?._id || userData?.id || '');
      // Always purge any stale local tracking session / passive motion timers on fresh login
      // so logging in NEVER auto-starts tracking from stale device state!
      await purgeLocalTrackingState();
      await storage.removeItem('user_manually_punched_out').catch(() => {});
      if (newUserId) {
        await storage.setItem('trackingOwnerUserId', newUserId);
      }

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
      
      await purgeLocalTrackingState();
      await storage.removeItem('trackingOwnerUserId').catch(() => {});
      await storage.removeItem('user_manually_punched_out').catch(() => {});

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
