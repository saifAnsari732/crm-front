import axios from 'axios';
import { storage } from './storage';
import { Platform } from 'react-native';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import Constants from 'expo-constants';

let unauthorizedCallback = null;
export const setUnauthorizedCallback = (callback) => {
  unauthorizedCallback = callback;
};

// =========================================================================
// BACKEND API CONFIGURATION
export const PROD_URL = 'https://kisanteamapp.online/api';
// export const LOCAL_URL = 'http://192.168.0.107:5000/api';

// Set to false for Production Server
const USE_LOCAL = false;

const getBaseUrl = () => {
  if (USE_LOCAL && __DEV__) {
    return LOCAL_URL;
  }
  return PROD_URL;
};


export const BASE_URL = getBaseUrl();
export const DEV_URL = BASE_URL;
export const getAvatarUrl = (avatarOrObj) => {
  if (!avatarOrObj) return null;
  let avatar = avatarOrObj;
  if (typeof avatarOrObj === 'object') {
    avatar = avatarOrObj.emp_profile_pic || 
             avatarOrObj.managerPro_pic || 
             avatarOrObj.avatar || 
             avatarOrObj.selfieUrl ||
             avatarOrObj.checkInImage ||
             avatarOrObj.receiptUrl ||
             avatarOrObj.daReceipt ||
             avatarOrObj.Org_logo || 
             avatarOrObj.companyLogo || 
             avatarOrObj.logo || null;
  }
  if (!avatar || typeof avatar !== 'string') return null;
  const clean = avatar.trim();
  if (clean === '' || clean === 'null' || clean === 'undefined') return null;

  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:image/')) {
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

// â”€â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const authAPI = {
  login: (data) => API.post('/auth/login', data),
  register: (data) => API.post('/auth/register', data),
  logout: () => API.post('/auth/logout'),
  refreshToken: () => API.post('/auth/refresh-token'),
  getMe: () => API.get('/auth/me'),
  updateProfile: (data) => API.put('/auth/profile', data),
  changePassword: (data) => API.put('/auth/change-password', data),
  verifyResetEmail: (email) => API.post('/auth/verify-reset-email', { email }),
  resetPasswordDirect: (email, newPassword) => API.post('/auth/reset-password-direct', { email, newPassword }),
};


// â”€â”€â”€ Tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const trackingAPI = {
  start:             (data)           => API.post('/tracking/start', data),
  update:            (data)           => API.post('/tracking/update', data),
  stop:              (data)           => API.post('/tracking/stop', data),
  heartbeat:         (data)           => API.post('/tracking/heartbeat', data),   // keepalive
  reconcile:         (sessionId)      => API.post('/tracking/reconcile', { sessionId }),
  getToday:          ()               => API.get('/tracking/today'),
  getTodaySessions:  ()               => API.get('/tracking/today'),              // alias
  getLive:           ()               => API.get('/tracking/live'),
  getLiveLocations:  ()               => API.get('/tracking/live-locations'),
  getSession:        (id)             => API.get(`/tracking/session/${id}`),
  geocode:           (lat, lng)       => API.get(`/tracking/geocode?lat=${lat}&lng=${lng}`),
  getEmployeeReport: (empId, params)  => API.get(`/tracking/report/employee/${empId}`, { params }),
  deleteHistory:     (empId)          => API.delete(`/tracking/history/employee/${empId}`),
  startTracking:     (...args) => {
    if (args[0] && typeof args[0] === 'object') {
      return API.post('/tracking/start', args[0]);
    }
    const [_, __, lat, lng, ___, selfieUrl] = args;
    return API.post('/tracking/start', { lat, lng, selfieUrl });
  },
};

// â”€â”€â”€ Meetings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const meetingAPI = {
  create: (data) => API.post('/meetings', data),
  getMy: (params) => API.get('/meetings/my', { params }),
  update: (id, data) => API.put(`/meetings/${id}`, data),
  getAll: (params) => API.get('/meetings/all', { params }),
};

// â”€â”€â”€ Expenses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const expenseAPI = {
  create: (data) => API.post('/expenses', data),
  claimDA: (data) => API.post('/expenses/claim-da', data),
  getMy: (params) => API.get('/expenses/my', { params }),
  getAll: (params) => API.get('/expenses/all', { params }),
  approve: (id, data) => API.put(`/expenses/${id}/approve`, data),
};

// ─── Leaves ───────────────────────────────────────────────────────────────────
export const leaveAPI = {
  apply: (data) => API.post('/leaves/apply', data),
  getMy: (params) => API.get('/leaves/my', { params }),
  getAll: (params) => API.get('/leaves/all', { params }),
  updateStatus: (id, data) => API.patch(`/leaves/${id}/status`, data),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const taskAPI = {
  create: (data) => API.post('/tasks', data),
  getMy: (params) => API.get('/tasks/my', { params }),
  getAll: (params) => API.get('/tasks/all', { params }),
  updateStatus: (id, data) => API.patch(`/tasks/${id}/status`, data),
};

// ─── Leads ────────────────────────────────────────────────────────────────────
export const leadAPI = {
  create: (data) => API.post('/leads', data),
  getAll: (params) => API.get('/leads', { params }),
  getById: (id) => API.get(`/leads/${id}`),
  update: (id, data) => API.put(`/leads/${id}`, data),
  delete: (id) => API.delete(`/leads/${id}`),
};

// â”€â”€â”€ Admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const adminAPI = {
  getDashboard: () => API.get('/admin/dashboard'),
  getEmployees: (params) => API.get('/admin/employees', { params }),
  createEmployee: (data) => API.post('/employees', data),
  createManager: (data) => API.post('/admin/managers', data),
  getManagers: () => API.get('/admin/managers'),
  approveEmployee: (id) => API.put(`/admin/employees/${id}/approve`),
  toggleBlock: (id) => API.put(`/admin/employees/${id}/block`),
  updateEmployee: (id, data) => API.put(`/admin/employees/${id}`, data),
  getAttendance: (params) => API.get('/admin/attendance', { params }),
  getHistory: (params) => API.get('/admin/tracking-history', { params }),
  getConsolidatedReport: (params) => API.get('/admin/reports/consolidated', { params }),
  getOrganization: () => API.get('/admin/organization'),
  updateOrganization: (data) => API.put('/admin/organization', data),
  getLeaves: (params) => API.get('/leaves/all', { params }),
  updateLeaveStatus: (id, data) => API.patch(`/leaves/${id}/status`, data),
  getExpenses: (params) => API.get('/expenses/all', { params }),
  updateExpenseStatus: (id, data) => API.put(`/expenses/${id}/approve`, data),
  getTasks: (params) => API.get('/tasks/all', { params }),
  getLeads: () => API.get('/leads'),
  getMeetings: (params) => API.get('/meetings/all', { params }),
};

// â”€â”€â”€ Employees â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const employeeAPI = {
  getAll: () => API.get('/employees'),
  getById: (id) => API.get(`/employees/${id}`),
  update: (id, data) => API.put(`/employees/${id}`, data),
  delete: (id) => API.delete(`/employees/${id}`),
};

// â”€â”€â”€ Attendance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const attendanceAPI = {
  getMy: () => API.get('/attendance/my'),
  getToday: () => API.get('/attendance/today'),
};

// â”€â”€â”€ Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const notificationAPI = {
  getAll: () => API.get('/notifications'),
  readAll: () => API.put('/notifications/read-all'),
};

// â”€â”€â”€ Upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const uploadAPI = {
  getAuth: () => API.get('/upload/auth'),
  uploadImage: (data) => API.post('/upload/image', data),
  uploadImageFormData: async (formDataOrUri, filename = 'image.jpg') => {
    try {
      console.log('API call: POST /upload/image');
      const token = await storage.getItem('userToken') || await storage.getItem('token');
      
      const fileUri = typeof formDataOrUri === 'string' 
        ? formDataOrUri 
        : (formDataOrUri && formDataOrUri.uri ? formDataOrUri.uri : null);

      // For Native (iOS/Android) we pass the URI and use expo-file-system
      if (fileUri && Platform.OS !== 'web') {
        const response = await FileSystemLegacy.uploadAsync(`${BASE_URL}/upload/image`, fileUri, {
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

// ─── Travel ───────────────────────────────────────────────────────────────────
export const travelAPI = {
  create: (data) => API.post('/travel', data),
  getAll: (params) => API.get('/travel', { params }),
  delete: (id) => API.delete(`/travel/${id}`),
};

// â”€â”€â”€ Dashboard Stats APIs (Extra compatibility) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const dashboardAPI = {
  getStats: () => API.get('/dashboard/stats'),
};

// â”€â”€â”€ BACKWARD COMPATIBILITY MAPPINGS FOR SCREEN IMPORTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const authApi = {
  login: (email, password) => (typeof email === 'object' && email !== null ? authAPI.login(email) : authAPI.login({ email, password })),
  register: (data) => authAPI.register(data),
  getMe: () => authAPI.getMe(),
  updateProfile: (data) => authAPI.updateProfile(data),
  changePassword: (data) => authAPI.changePassword(data),
  verifyResetEmail: (email) => authAPI.verifyResetEmail(email),
  resetPasswordDirect: (email, newPassword) => authAPI.resetPasswordDirect(email, newPassword),
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
  heartbeat: (data) => trackingAPI.heartbeat(data),          // â† NEW: keepalive ping
  reconcile: (sessionId) => trackingAPI.reconcile(sessionId),
  getTodaySessions: () => trackingAPI.getToday(),
  getLiveEmployees:  () => trackingAPI.getLive(),
  getSessionRoute:   (id) => trackingAPI.getSession(id),
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
