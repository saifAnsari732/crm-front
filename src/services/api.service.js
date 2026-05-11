import axios from 'axios';

// const API = axios.create({
//   baseURL:'http://localhost:5000/api',
//   withCredentials: true,
// });
const API = axios.create({
  baseURL:'https://crm-b-y8rv.onrender.com/api',
  withCredentials: true,
});

// Attach token
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => API.post('/auth/login', data),
  register: (data) => API.post('/auth/register', data),
  logout: () => API.post('/auth/logout'),
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
  getSession: (id) => API.get(`/tracking/session/${id}`),
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

export default API;
