import axios from 'axios';
import storage from './storage';

const API_BASE = 'https://client-file-manager.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 35000,
});

api.interceptors.request.use(async (config) => {
  const token = await storage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await storage.removeItem('accessToken');
      await storage.removeItem('refreshToken');
    }
    return Promise.reject(err);
  }
);

export default api;

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  getMe: () => api.get('/auth/me'),
};

export const customerAPI = {
  getDepartments: () => api.get('/customer/departments'),
  getCategories: () => api.get('/customer/categories'),
  getDocuments: (params) => api.get('/customer/documents', { params }),
  uploadDocument: (formData) =>
    api.post('/customer/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  downloadDocument: (id, type) =>
    api.get(`/customer/documents/${id}/download`, {
      params: { type },
      responseType: 'blob',
    }),
};
