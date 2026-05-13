import axios from 'axios';

const API = axios.create({
  baseURL:'https://crm-b-y8rv.onrender.com/api',
  // baseURL: 'http://localhost:5000/api',
  withCredentials: true,
});

let refreshTokenPromise = null;

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
 * Response interceptor: Handle 401 with token refresh
 */
API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    // Handle 401 (Unauthorized)
    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Only refresh token once (prevent multiple refresh requests)
        if (!refreshTokenPromise) {
          refreshTokenPromise = API.post('/auth/refresh-token');
        }

        const { data } = await refreshTokenPromise;
        refreshTokenPromise = null;

        if (data.token) {
          localStorage.setItem('token', data.token);
          originalRequest.headers.Authorization = `Bearer ${data.token}`;
          return API(originalRequest);
        }
      } catch (refreshErr) {
        refreshTokenPromise = null;
        // Refresh failed - clear auth and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
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
  getAttendance: (params) => API.get('/admin/attendance', { params }),
  getHistory: (params) => API.get('/admin/tracking-history', { params }),
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

export default API;
