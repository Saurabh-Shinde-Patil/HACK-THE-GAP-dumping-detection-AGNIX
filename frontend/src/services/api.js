import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

// Attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('cc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cc_token');
      localStorage.removeItem('cc_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (data) => API.post('/auth/login', data);
export const register = (data) => API.post('/auth/register', data);
export const getMe = () => API.get('/auth/me');
export const updateProfile = (data) => API.put('/auth/profile', data);

// Reports
export const getReports = (params) => API.get('/reports', { params });
export const getReport = (id) => API.get(`/reports/${id}`);
export const createReport = (formData) => API.post('/reports', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateReport = (id, data) => API.put(`/reports/${id}`, data);
export const getReportStats = () => API.get('/reports/stats');

// Tasks
export const getTasks = (params) => API.get('/tasks', { params });
export const getTask = (id) => API.get(`/tasks/${id}`);
export const assignTask = (data) => API.post('/tasks', data);
export const updateTask = (id, formData) => API.put(`/tasks/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getTaskStats = () => API.get('/tasks/stats');

// Analytics
export const getDashboard = () => API.get('/analytics/dashboard');
export const getHotspots = () => API.get('/analytics/hotspots');
export const getTrends = (days) => API.get('/analytics/trends', { params: { days } });
export const getWorkerPerformance = () => API.get('/analytics/workers');
export const getWardStats = () => API.get('/analytics/wards');

// Users
export const getUsers = (params) => API.get('/users', { params });
export const getWorkers = (params) => API.get('/users/workers', { params });
export const updateUserRole = (id, role) => API.put(`/users/${id}/role`, { role });
export const deactivateUser = (id) => API.put(`/users/${id}/deactivate`);

// Audit
export const getAuditLogs = (params) => API.get('/audit', { params });

export default API;
