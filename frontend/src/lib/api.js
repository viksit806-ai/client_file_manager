import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

function getToken(key) {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
}

api.interceptors.request.use((config) => {
  const token = getToken('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      clearTokens();
      window.location.href = '/login';
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

export const notificationAPI = {
  getAll: (config) => api.get('/notifications', config),
  getCount: (config) => api.get('/notifications/count', config),
  dismiss: (id) => api.delete(`/notifications/${id}`),
};

export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getCustomers: (params) => api.get('/admin/customers', { params }),
  createCustomer: (data) => api.post('/admin/customers', data),
  updateCustomer: (id, data) => api.put(`/admin/customers/${id}`, data),
  deleteCustomer: (id) => api.delete(`/admin/customers/${id}`),
  resetPassword: (id) => api.put(`/admin/customers/${id}/reset-password`),
  setPassword: (id, data) => api.put(`/admin/customers/${id}/set-password`, data),
  getCustomerDocuments: (id, params) => api.get(`/admin/customers/${id}/documents`, { params }),
  getDepartments: () => api.get('/admin/departments'),
  createDepartment: (data) => api.post('/admin/departments', data),
  updateDepartment: (id, data) => api.put(`/admin/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/admin/departments/${id}`),
  updatePermissions: (id, data) => api.put(`/admin/departments/${id}/permissions`, data),
  getDepartmentUsers: (params) => api.get('/admin/department-users', { params }),
  getDeptUsersByDept: (deptId) => api.get(`/admin/department-users/department/${deptId}`),
  createDepartmentUser: (data) => api.post('/admin/department-users', data),
  updateDepartmentUser: (id, data) => api.put(`/admin/department-users/${id}`, data),
  deleteDepartmentUser: (id) => api.delete(`/admin/department-users/${id}`),
  resetDeptUserPassword: (id) => api.put(`/admin/department-users/${id}/reset-password`),
  setDeptUserPassword: (id, data) => api.put(`/admin/department-users/${id}/set-password`, data),
  getFileCategories: (params) => api.get('/admin/file-categories', { params }),
  createFileCategory: (data) => api.post('/admin/file-categories', data),
  updateFileCategory: (id, data) => api.put(`/admin/file-categories/${id}`, data),
  deleteFileCategory: (id) => api.delete(`/admin/file-categories/${id}`),
  getAllDocuments: (params) => api.get('/admin/documents', { params }),
  blockDocument: (id) => api.patch(`/admin/documents/${id}/block`),
  unblockDocument: (id) => api.patch(`/admin/documents/${id}/unblock`),
  updateDocument: (id, data) => api.put(`/admin/documents/${id}`, data),
  deleteDocument: (id) => api.delete(`/admin/documents/${id}`),
  purgeDocumentFiles: (id) => api.post(`/admin/documents/${id}/purge`),
  renameDocument: (id, data) => api.patch(`/admin/documents/${id}/rename`, data),
  renameGroup: (groupId, data) => api.patch(`/admin/documents/group/${groupId}/rename`, data),
  softDeleteDocument: (id, data) => api.delete(`/admin/documents/${id}/soft`, { data }),
  softDeleteGroup: (groupId) => api.delete(`/admin/documents/group/${groupId}/soft`),
  createFolder: (data) => api.post('/admin/documents/folder', data),
  uploadFilesToFolder: (groupId, formData) => api.post(`/admin/documents/group/${groupId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const customerAPI = {
  getDepartments: () => api.get('/customer/departments'),
  getDocuments: (params) => api.get('/customer/documents', { params }),
  uploadDocument: (formData, config) => api.post('/customer/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  }),

  downloadDocument: (id, type) => api.get(`/customer/documents/${id}/download`, { params: { type }, responseType: 'blob' }),
  getResponses: (params) => api.get('/customer/responses', { params }),
  getResponseCategories: () => api.get('/customer/response-categories'),
};

export const departmentAPI = {
  getDashboard: () => api.get('/department/dashboard'),
  getCustomers: (params) => api.get('/department/customers', { params }),
  getCustomerDocuments: (customerId, params) => api.get(`/department/customers/${customerId}/documents`, { params }),
  renameCustomer: (customerId, data) => api.patch(`/department/customers/${customerId}/rename`, data),
  getDocuments: (params) => api.get('/department/documents', { params }),
  getFileCategories: () => api.get('/department/file-categories'),
  getDocumentDetail: (id) => api.get(`/department/documents/${id}`),
  updateStatus: (id, data) => api.patch(`/department/documents/${id}/status`, data),
  createResponse: (formData) => api.post('/department/responses', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getResponses: (params) => api.get('/department/responses', { params }),
  blockDocument: (id) => api.patch(`/department/documents/${id}/block`),
  unblockDocument: (id) => api.patch(`/department/documents/${id}/unblock`),
  updateNotes: (id, data) => api.put(`/department/documents/${id}/notes`, data),
  downloadFile: (id, type) => api.get(`/department/documents/${id}/download`, { params: { type }, responseType: 'blob' }),
  purgeDocumentFiles: (id) => api.post(`/department/documents/${id}/purge`),
  renameDocument: (id, data) => api.patch(`/department/documents/${id}/rename`, data),
  renameGroup: (groupId, data) => api.patch(`/department/documents/group/${groupId}/rename`, data),
  deleteDocument: (id, data) => api.delete(`/department/documents/${id}`, { data }),
  deleteGroup: (groupId) => api.delete(`/department/documents/group/${groupId}`),
  createFolder: (data) => api.post('/department/documents/folder', data),
  uploadFilesToFolder: (groupId, formData) => api.post(`/department/documents/group/${groupId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  batchDocuments: (data) => api.post('/department/documents/batch', data),
};


export const searchAPI = {
  globalSearch: (q, config) => api.get('/search', { params: { q }, ...config }),
};

