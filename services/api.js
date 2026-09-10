import axios from 'axios';
import { storage } from './storage';
import { Platform } from 'react-native';
import * as FileSystemLegacy from 'expo-file-system/legacy';

let unauthorizedCallback = null;
export const setUnauthorizedCallback = (callback) => {
  unauthorizedCallback = callback;
};

// ==========================================
// GROUP 1: WEB & EXPO GO (LOCAL TESTING)
// ==========================================
// Web par localhost chalega, aur Expo Go par aapka WiFi IP
const DEV_URL = Platform.OS === 'web' ? 'http://localhost:5000/api' : 'http://192.168.0.110:5000/api';

// ==========================================
// GROUP 2: PRODUCTION (LIVE SERVER)
// ==========================================
const PROD_URL = 'https://kisanteamapp.online/api';

const resolveBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim()) return envUrl.trim();

  // Abhi testing ke liye DEV_URL return kar rahe hain
  // Agar production live karna ho, toh PROD_URL ko uncomment karein aur DEV_URL ko comment karein.
  
  return DEV_URL;
  // return PROD_URL;
};

export const BASE_URL = resolveBaseUrl();

export const getAvatarUrl = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return null;
  const clean = avatar.trim();
  if (clean === '' || clean === 'null' || clean === 'undefined') return null;
  
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  
  const baseUrlWithoutApi = BASE_URL.replace('/api', '');
  if (clean.startsWith('/')) {
    return `${baseUrlWithoutApi}${clean}`;
  }
  return `${baseUrlWithoutApi}/${clean}`;
};

const API = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

let refreshTokenPromise = null;              

/**
 
 * Request interceptor: Attach token dynamically from mobile storage

 */
API.interceptors.request.use(async (config) => {
  try {
    const token = await storage.getItem('userToken') || await storage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.error('Error in request interceptor:', e);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

/**
 * Response interceptor: Handle 401 with token refresh
 */
API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    // Handle 401 (Unauthorized)
    const isAuthRequest = originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh-token');
    
    if (err.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;

      try {
        // Only refresh token once (prevent multiple refresh requests)
        if (!refreshTokenPromise) {
          refreshTokenPromise = API.post('/auth/refresh-token');
        }

        const { data } = await refreshTokenPromise;
        refreshTokenPromise = null;

        if (data.token) {
          await storage.setItem('userToken', data.token);
          await storage.setItem('token', data.token);
          originalRequest.headers.Authorization = `Bearer ${data.token}`;
          return API(originalRequest);
        }
      } catch (refreshErr) {
        refreshTokenPromise = null;
        // Refresh failed - clear mobile auth
        await storage.removeItem('userToken');
        await storage.removeItem('token');
        await storage.removeItem('user');
        await storage.removeItem('userData');
        if (unauthorizedCallback) {
          unauthorizedCallback();
        }
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(err);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => API.post('/auth/login', data),
  register: (data) => API.post('/auth/register', data),
  logout: () => API.post('/auth/logout'),
  refreshToken: () => API.post('/auth/refresh-token'),
  getMe: () => API.get('/auth/me'),
  updateProfile: (data) => API.put('/auth/profile', data),
  changePassword: (data) => API.put('/auth/change-password', data),
};

// ─── Tracking ──────────────────────────────────────────────────────────────
export const trackingAPI = {
  start: (data) => API.post('/tracking/start', data),
  update: (data) => API.post('/tracking/update', data),
  stop: (data) => API.post('/tracking/stop', data),
  getToday: () => API.get('/tracking/today'),
  getLive: () => API.get('/tracking/live'),
  getLiveLocations: () => API.get('/tracking/live-locations'),
  getSession: (id) => API.get(`/tracking/session/${id}`),
  geocode: (lat, lng) => API.get(`/tracking/geocode?lat=${lat}&lng=${lng}`),
  getEmployeeReport: (employeeId, params) => API.get(`/tracking/report/employee/${employeeId}`, { params }),
  deleteHistory: (employeeId) => API.delete(`/tracking/history/employee/${employeeId}`),
};

// ─── Meetings ─────────────────────────────────────────────────────────────
export const meetingAPI = {
  create: (data) => API.post('/meetings', data),
  getMy: (params) => API.get('/meetings/my', { params }),
  update: (id, data) => API.put(`/meetings/${id}`, data),
  getAll: (params) => API.get('/meetings/all', { params }),
};

// ─── Expenses ─────────────────────────────────────────────────────────────
export const expenseAPI = {
  create: (data) => API.post('/expenses', data),
  claimDA: (data) => API.post('/expenses/claim-da', data),
  getMy: (params) => API.get('/expenses/my', { params }),
  getAll: (params) => API.get('/expenses/all', { params }),
  approve: (id, data) => API.put(`/expenses/${id}/approve`, data),
};

// ─── Admin ────────────────────────────────────────────────────────────────
export const adminAPI = {
  getDashboard: () => API.get('/admin/dashboard'),
  getEmployees: (params) => API.get('/admin/employees', { params }),
  approveEmployee: (id) => API.put(`/admin/employees/${id}/approve`),
  toggleBlock: (id) => API.put(`/admin/employees/${id}/block`),
  updateEmployee: (id, data) => API.put(`/admin/employees/${id}`, data),
  getAttendance: (params) => API.get('/admin/attendance', { params }),
  getHistory: (params) => API.get('/admin/tracking-history', { params }),
  getConsolidatedReport: (params) => API.get('/admin/reports/consolidated', { params }),
};

// ─── Employees ────────────────────────────────────────────────────────────
export const employeeAPI = {
  getAll: () => API.get('/employees'),
  getById: (id) => API.get(`/employees/${id}`),
  update: (id, data) => API.put(`/employees/${id}`, data),
  delete: (id) => API.delete(`/employees/${id}`),
};

// ─── Attendance ───────────────────────────────────────────────────────────
export const attendanceAPI = {
  getMy: () => API.get('/attendance/my'),
  getToday: () => API.get('/attendance/today'),
};

// ─── Notifications ────────────────────────────────────────────────────────
export const notificationAPI = {
  getAll: () => API.get('/notifications'),
  readAll: () => API.put('/notifications/read-all'),
};

// ─── Upload ───────────────────────────────────────────────────────────────
export const uploadAPI = {
  getAuth: () => API.get('/upload/auth'),
  uploadImage: (data) => API.post('/upload/image', data),
  uploadImageFormData: async (formDataOrUri, filename = 'image.jpg') => {
    try {
      console.log('API call: POST /upload/image');
      const token = await storage.getItem('userToken') || await storage.getItem('token');
      
      // For Native (iOS/Android) we pass the URI and use expo-file-system
      if (typeof formDataOrUri === 'string' && Platform.OS !== 'web') {
        const response = await FileSystemLegacy.uploadAsync(`${BASE_URL}/upload/image`, formDataOrUri, {
          httpMethod: 'POST',
          uploadType: FileSystemLegacy.FileSystemUploadType?.MULTIPART ?? 1,
          fieldName: 'image',
          mimeType: 'image/jpeg',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = JSON.parse(response.body);
        return { data };
      }
      
      // Fallback for Web where it's a real FormData object
      const response = await fetch(`${BASE_URL}/upload/image`, {
        method: 'POST',
        body: formDataOrUri,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      return { data };
    } catch (err) {
      console.error('Upload Error:', err);
      return { data: { success: false, message: err.message || 'Network Error' } };
    }
  },
  uploadImageDirect: async (formDataOrObj) => {
    try {
      // 1. Get Auth params from our backend
      const authRes = await API.get('/upload/auth');
      if (!authRes.data.success) throw new Error('Failed to get upload auth');
      const { signature, expire, token, publicKey } = authRes.data;

      // For Native: if we received an object with uri, use FileSystem.uploadAsync
      if (typeof formDataOrObj === 'object' && formDataOrObj.uri && Platform.OS !== 'web') {
        const response = await FileSystemLegacy.uploadAsync('https://upload.imagekit.io/api/v1/files/upload', formDataOrObj.uri, {
          httpMethod: 'POST',
          uploadType: FileSystemLegacy.FileSystemUploadType?.MULTIPART ?? 1,
          fieldName: 'file',
          mimeType: 'image/jpeg',
          parameters: {
            fileName: formDataOrObj.fileName || 'image.jpg',
            folder: formDataOrObj.folder || '/',
            publicKey,
            signature,
            expire: String(expire),
            token
          }
        });
        const data = JSON.parse(response.body);
        if (data.fileId) {
          return { data: { success: true, url: data.url, fileId: data.fileId, thumbnailUrl: data.thumbnailUrl } };
        }
        return { data: { success: false, message: data.message || 'ImageKit upload failed' } };
      }

      // 2. Append Auth params to the existing FormData for web
      formDataOrObj.append('publicKey', publicKey);
      formDataOrObj.append('signature', signature);
      formDataOrObj.append('expire', expire);
      formDataOrObj.append('token', token);

      // 3. Upload directly to ImageKit bypassing our Node/PHP server
      const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        body: formDataOrObj,
      });

      const data = await response.json();
      if (data.fileId) {
        return { data: { success: true, url: data.url, fileId: data.fileId, thumbnailUrl: data.thumbnailUrl } };
      } else {
        return { data: { success: false, message: data.message || 'ImageKit upload failed' } };
      }
    } catch (err) {
      console.error('Direct Upload Error:', err);
      return { data: { success: false, message: err.message || 'Network Error' } };
    }
  },
};

// ─── Leaves ───────────────────────────────────────────────────────────────
export const leaveAPI = {
  apply: (data) => API.post('/leaves/apply', data),
  getMy: () => API.get('/leaves/my'),
  getAll: (params) => API.get('/leaves/all', { params }),
  updateStatus: (id, data) => API.patch(`/leaves/${id}/status`, data),
};

// ─── Tasks ────────────────────────────────────────────────────────────────
export const taskAPI = {
  create: (data) => API.post('/tasks', data),
  getAll: (params) => API.get('/tasks/all', { params }),
  getMy: (params) => API.get('/tasks/my', { params }),
  updateStatus: (id, data) => API.patch(`/tasks/${id}/status`, data),
};

// ─── Leads ────────────────────────────────────────────────────────────────
export const leadAPI = {
  create: (data) => API.post('/leads', data),
  getAll: () => API.get('/leads'),
  update: (id, data) => API.put(`/leads/${id}`, data),
  delete: (id) => API.delete(`/leads/${id}`),
};

// ─── Travel ───────────────────────────────────────────────────────────────
export const travelAPI = {
  create: (data) => API.post('/travel', data),
  getAll: (params) => API.get('/travel', { params }),
  delete: (id) => API.delete(`/travel/${id}`),
};

// ─── Dashboard Stats APIs (Extra compatibility) ───────────────────────────
export const dashboardAPI = {
  getStats: () => API.get('/dashboard/stats'),
};

// ─── BACKWARD COMPATIBILITY MAPPINGS FOR SCREEN IMPORTS ────────────────────
export const authApi = {
  login: (email, password) => authAPI.login({ email, password }),
  register: (data) => authAPI.register(data),
  getMe: () => authAPI.getMe(),
  updateProfile: (data) => authAPI.updateProfile(data),
  changePassword: (data) => authAPI.changePassword(data),
};

export const trackingApi = {
  startTracking: (sessionId, startTime, lat, lng, startAddress = '', selfieUrl = '') => {
    return trackingAPI.start({ sessionId, startTime, lat, lng, startAddress, selfieUrl });
  },
  updateLocation: (sessionId, coordinates, totalDistance = 0) => {
    return trackingAPI.update({ sessionId, coordinates, totalDistance });
  },
  stopTracking: (sessionId, endTime, endAddress = '', totalDistance = 0) => {
    return trackingAPI.stop({ sessionId, endTime, endAddress, totalDistance });
  },
  getTodaySessions: () => trackingAPI.getToday(),
  getLiveEmployees: () => trackingAPI.getLive(),
  getSessionRoute: (id) => trackingAPI.getSession(id),
};

export const meetingApi = {
  create: (data) => meetingAPI.create(data),
  getMy: (params) => meetingAPI.getMy(params),
  update: (id, data) => meetingAPI.update(id, data),
};

export const expenseApi = {
  create: (data) => expenseAPI.create(data),
  claimDA: (data) => expenseAPI.claimDA(data),
  getMy: (params) => expenseAPI.getMy(params),
};

export const adminApi = {
  getStats: () => adminAPI.getDashboard(),
  getAllEmployees: (params) => adminAPI.getEmployees(params),
  approveEmployee: (id) => adminAPI.approveEmployee(id),
  toggleBlock: (id) => adminAPI.toggleBlock(id),
  getAttendanceReport: (date) => adminAPI.getAttendance({ date }),
  getAllMeetings: (params) => meetingAPI.getAll(params),
  getAllExpenses: (params) => expenseAPI.getAll(params),
  approveExpense: (id, approved = true, reason = '') => {
    const status = approved ? 'approved' : 'rejected';
    return expenseAPI.approve(id, { status, rejectionReason: reason });
  },
};

export const employeeApi = {
  getMe: () => employeeAPI.getAll().then(res => {
    // compatibility mapping
    return res;
  }),
  getById: (id) => employeeAPI.getById(id),
  update: (id, data) => employeeAPI.update(id, data),
  delete: (id) => employeeAPI.delete(id),
};

export const attendanceApi = {
  getMyHistory: (month, year) => attendanceAPI.getMy({ month, year }),
  getTodayRecord: () => attendanceAPI.getToday(),
};

export const leaveApi = {
  apply: (data) => leaveAPI.apply(data),
  getMy: () => leaveAPI.getMy(),
  getAll: (params) => leaveAPI.getAll(params),
  updateStatus: (id, status, reason = '') => leaveAPI.updateStatus(id, { status, rejectionReason: reason }),
};

export const taskApi = {
  create: (data) => taskAPI.create(data),
  getMy: (params) => taskAPI.getMy(params),
  getAll: (params) => taskAPI.getAll(params),
  updateStatus: (id, status) => taskAPI.updateStatus(id, { status }),
};

export const notificationApi = {
  getAll: () => notificationAPI.getAll(),
  markRead: (id) => API.put(`/notifications/${id}/read`), // Inline fallback
  markAllRead: () => notificationAPI.readAll(),
};

export const dashboardApi = {
  getStats: () => dashboardAPI.getStats(),
};

export default API;
