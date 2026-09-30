import axios from 'axios';

// ==========================================
// BACKEND API BASE CONFIGURATION (DUAL ENV)
// ==========================================
// export const PROD_API_URL = 'https://field-backend-monitor-web-ym7d.onrender.com/api';
export const DEV_API_URL = 'http://localhost:5001/api';

const resolveApiBase = () => {
  if (import.meta.env?.VITE_API_URL) return import.meta.env.VITE_API_URL.trim();
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL.trim();
  
  // Auto-detect Production vs Development
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')) {
      return DEV_API_URL;
    }
  }
  return DEV_API_URL;
};
 
const API_BASE = resolveApiBase();

const API = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

export { API, API_BASE };

let refreshTokenPromise = null;

/**
 * Request interceptor: Attach token to all requests
 */
/**
 * Request interceptor: Attach token to all requests
 */
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Response interceptor: Handle 401 with silent dual-token refresh
 */
API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    // Handle 401 (Unauthorized - Access Token Expired)
    const isAuthRequest =
      originalRequest.url.includes('/auth/login') ||
      originalRequest.url.includes('/auth/refresh-token') ||
      originalRequest.url.includes('/auth/register');

    if (err.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;

      const storedRefreshToken = localStorage.getItem('refreshToken');
      if (!storedRefreshToken) {
        // No refresh token available, force clean logout
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('organization');
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(err);
      }

      try {
        // Only refresh token once across concurrent requests
        if (!refreshTokenPromise) {
          refreshTokenPromise = axios.post(`${API_BASE}/auth/refresh-token`, {
            refreshToken: storedRefreshToken,
          });
        }

        const { data } = await refreshTokenPromise;
        refreshTokenPromise = null;

        if (data.token) {
          localStorage.setItem('token', data.token);
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }

          // Re-issue failed request with new access token
          originalRequest.headers.Authorization = `Bearer ${data.token}`;
          return API(originalRequest);
        }
      } catch (refreshErr) {
        refreshTokenPromise = null;
        // Refresh token itself expired or invalid
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('organization');
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      }
    }

    // Handle 402 (Payment Required / Plan Inactive)
    if (err.response?.status === 402) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/admin/billing')) {
        setTimeout(() => {
          window.location.href = '/admin/billing';
        }, 1200);
      }
    }

    return Promise.reject(err);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => API.post('/auth/login', data),
  register: (data) => API.post('/auth/register', data),
  registerOrganization: (data) => API.post('/auth/register-organization', data),
  logout: () => API.post('/auth/logout'),
  refreshToken: (refreshToken) =>
    axios.post(`${API_BASE}/auth/refresh-token`, {
      refreshToken: refreshToken || localStorage.getItem('refreshToken'),
    }),
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
  delete: (id) => API.delete(`/meetings/${id}`),
};

// ─── Expenses ─────────────────────────────────────────────────────────────
export const expenseAPI = {
  create: (data) => API.post('/expenses', data),
  getMy: (params) => API.get('/expenses/my', { params }),
  getAll: (params) => API.get('/expenses/all', { params }),
  approve: (id, data) => API.put(`/expenses/${id}/approve`, data),
  delete: (id) => API.delete(`/expenses/${id}`),
};

// ─── Admin ────────────────────────────────────────────────────────────────
export const adminAPI = {
  getDashboard: () => API.get('/admin/dashboard'),
  getEmployees: (params) => API.get('/admin/employees', { params }),
  getManagers: () => API.get('/admin/managers'),
  createManager: (data) => API.post('/admin/managers', data),
  approveEmployee: (id) => API.put(`/admin/employees/${id}/approve`),
  toggleBlock: (id) => API.put(`/admin/employees/${id}/block`),
  updateEmployee: (id, data) => API.put(`/admin/employees/${id}`, data),
  getAttendance: (params) => API.get('/admin/attendance', { params }),
  getHistory: (params) => API.get('/admin/tracking-history', { params }),
  adjustDistance: (data) => API.put('/admin/tracking/adjust-distance', data),
  getConsolidatedReport: (params) => API.get('/admin/reports/consolidated', { params }),
  getOrganization: () => API.get('/admin/organization'),
  updateOrganization: (data) => API.put('/admin/organization', data),
};

// ─── Manager ──────────────────────────────────────────────────────────────
export const managerAPI = {
  getDashboard: () => API.get('/manager/dashboard-stats'),
  getTeam: (params) => API.get('/manager/team', { params }),
  getMeetings: (params) => API.get('/manager/meetings', { params }),
  getExpenses: (params) => API.get('/manager/expenses', { params }),
  getAttendance: (params) => API.get('/manager/attendance', { params }),
  getHistory: (params) => API.get('/manager/tracking-history', { params }),
};

// ─── Employees ────────────────────────────────────────────────────────────
export const employeeAPI = {
  getAll: () => API.get('/employees'),
  getById: (id) => API.get(`/employees/${id}`),
  update: (id, data) => API.put(`/employees/${id}`, data),
  block: (id) => API.put(`/employees/${id}/block`),
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
  uploadImage: (formData) => API.post('/upload/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// ─── Leaves ───────────────────────────────────────────────────────────────
export const leaveAPI = {
  apply: (data) => API.post('/leaves/apply', data),
  getMy: () => API.get('/leaves/my'),
  getAll: (params) => API.get('/leaves/all', { params }),
  updateStatus: (id, data) => API.patch(`/leaves/${id}/status`, data),
  delete: (id) => API.delete(`/leaves/${id}`),
};

// ─── Tasks ────────────────────────────────────────────────────────────────
export const taskAPI = {
  create: (data) => API.post('/tasks', data),
  getAll: (params) => API.get('/tasks/all', { params }),
  getMy: (params) => API.get('/tasks/my', { params }),
  update: (id, data) => API.put(`/tasks/${id}`, data),
  updateStatus: (id, data) => API.patch(`/tasks/${id}/status`, data),
  delete: (id) => API.delete(`/tasks/${id}`),
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

export default API;
