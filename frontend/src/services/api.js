import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL || '';
const apiBase = rawApiUrl
  ? `${rawApiUrl.replace(/\/$/, '').replace(/\/api$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL: apiBase,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pd_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/change-password')) {
      localStorage.removeItem('pd_token');
      localStorage.removeItem('pd_user');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || { message: 'Network error. Please check your connection.' });
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/profile', data),
  changePassword: (data) => api.patch('/auth/change-password', data),
};

export const shopAPI = {
  getAll: (params) => api.get('/shops', { params }),
  getStats: () => api.get('/shops/public-stats'),
  getNearby: (params) => api.get('/shops/nearby', { params }),
  getById: (id) => api.get(`/shops/${id}`),
  create: (data) => api.post('/shops', data),
  getMyShop: () => api.get('/shops/owner/my-shop'),
  getMyShopDashboard: () => api.get('/shops/owner/dashboard'),
  update: (id, data) => api.put(`/shops/${id}`, data),
  updateStatus: (id, status) => api.patch(`/shops/${id}/status`, { status }),
  updatePrinters: (id, printers) => api.patch(`/shops/${id}/printers`, { printers }),
  updateWalkInTraffic: (id, walkInTrafficLevel) => api.patch(`/shops/${id}/walk-in-traffic`, { walkInTrafficLevel }),
  updateWalkInCount: (id, count, walkInTrafficLevel) => api.patch(`/shops/${id}/walk-in-count`, { count, walkInTrafficLevel }),
  updateOperationalStatus: (id, data) => api.patch(`/shops/${id}/operational-status`, data),
  setTemporaryClosure: (id, data) => api.post(`/shops/${id}/temporary-closure`, data),
  reopenShop: (id) => api.post(`/shops/${id}/reopen`),
  replaceBusinessDocument: (docType, formData) => api.post(`/shops/owner/documents/${docType}/replace`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadStorefrontPhoto: (formData) => api.post('/shops/owner/storefront-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteStorefrontPhoto: () => api.delete('/shops/owner/storefront-photo'),
  getSales: (params) => api.get('/shops/owner/sales', { params }),
  getReviews: (id, params) => api.get(`/shops/${id}/reviews`, { params }),
  getOwnerReviews: (params) => api.get('/shops/owner/reviews', { params }),
  getPublicReviews: (id, params) => api.get(`/shops/${id}/public-reviews`, { params }),
};

export const documentAPI = {
  upload: (formData, onUploadProgress) => api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  }),
  getMyDocuments: () => api.get('/documents/my'),
  getById: (id) => api.get(`/documents/${id}`, { responseType: 'blob' }),
  getViewUrl: (id) => {
    const token = localStorage.getItem('pd_token');
    return `${apiBase}/documents/${id}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  delete: (id) => api.delete(`/documents/${id}`),
};

export const requestAPI = {
  submit: (data) => api.post('/printing-requests', data),
  getMyRequests: (params) => api.get('/printing-requests/my', { params }),
  getById: (id) => api.get(`/printing-requests/${id}`),
  getStatusHistory: (id) => api.get(`/printing-requests/${id}/history`),
  getShopRequests: (shopId, params) => api.get(`/printing-requests/shop/${shopId}`, { params }),
  updateStatus: (id, status, reason) => api.patch(`/printing-requests/${id}/status`, { status, reason }),
  cancel: (id, reason) => api.patch(`/printing-requests/${id}/cancel`, { reason }),
  submitReview: (id, data) => api.post(`/printing-requests/${id}/review`, data),
  addShopNote: (id, noteData) => api.post(`/printing-requests/${id}/notes`, noteData),
  broadcastDelay: (shopId, delayData) => api.post(`/printing-requests/shop/${shopId}/broadcast-delay`, delayData),
  clearDelay: (shopId) => api.post(`/printing-requests/shop/${shopId}/clear-delay`),
  uploadPaymentProof: (formData) => api.post('/printing-requests/upload-proof', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  attachPaymentProof: (id, data) => api.patch(`/printing-requests/${id}/payment-proof`, data),
  verifyPayment: (id, paymentStatus) => api.patch(`/printing-requests/${id}/verify-payment`, { paymentStatus }),
  getPaymentProofUrl: (id, fallbackUrl = '') => {
    const token = localStorage.getItem('pd_token');
    if (id) {
      return `${apiBase}/printing-requests/${id}/payment-proof${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    }
    if (!fallbackUrl) return '';
    const origin = apiBase.replace(/\/api$/, '');
    const cleanUrl = fallbackUrl.startsWith('http') ? fallbackUrl : `${origin}${fallbackUrl.startsWith('/') ? '' : '/'}${fallbackUrl}`;
    const sep = cleanUrl.includes('?') ? '&' : '?';
    return token ? `${cleanUrl}${sep}token=${encodeURIComponent(token)}` : cleanUrl;
  },
};

export const queueAPI = {
  getActiveQueue: (shopId) => api.get(`/queue/shops/${shopId}`),
};

export const recommendationAPI = {
  getRankedShops: (params) => api.get('/recommendations/shops', { params }),
  getRoute: (shopIdOrParams, maybeParams) => {
    let targetShopId = shopIdOrParams;
    let queryParams = maybeParams || {};
    if (typeof shopIdOrParams === 'object' && shopIdOrParams !== null) {
      targetShopId = shopIdOrParams.shopId || shopIdOrParams.id || shopIdOrParams._id;
      queryParams = {
        lat: shopIdOrParams.lat ?? shopIdOrParams.originLat,
        lng: shopIdOrParams.lng ?? shopIdOrParams.originLng,
        travelMode: shopIdOrParams.travelMode || 'motor',
      };
    }
    return api.get(`/recommendations/route/${targetShopId}`, { params: queryParams });
  },
  getRouteToShop: (shopIdOrParams, maybeParams) => {
    let targetShopId = shopIdOrParams;
    let queryParams = maybeParams || {};
    if (typeof shopIdOrParams === 'object' && shopIdOrParams !== null) {
      targetShopId = shopIdOrParams.shopId || shopIdOrParams.id || shopIdOrParams._id;
      queryParams = {
        lat: shopIdOrParams.lat ?? shopIdOrParams.originLat,
        lng: shopIdOrParams.lng ?? shopIdOrParams.originLng,
        travelMode: shopIdOrParams.travelMode || 'motor',
      };
    }
    return api.get(`/recommendations/route/${targetShopId}`, { params: queryParams });
  },
};

export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  getById: (id) => api.get(`/notifications/${id}`),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
  clearAll: () => api.delete('/notifications'),
};

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getReports: (params) => api.get('/admin/reports', { params }),
  getUsers: (params) => api.get('/admin/users', { params }),
  createUser: (data) => api.post('/admin/users', data),
  deactivateUser: (id) => api.patch(`/admin/users/${id}/deactivate`),
  toggleUserStatus: (id, payload) => {
    if (typeof payload === 'object') {
      return api.patch(`/admin/users/${id}/status`, payload);
    }
    return api.patch(`/admin/users/${id}/status`, { isActive: payload });
  },
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getShops: (params) => api.get('/admin/shops', { params }),
  getShopById: (id) => api.get(`/admin/shops/${id}`),
  verifyShop: (id, verificationStatus, rejectionReason) =>
    api.patch(`/admin/shops/${id}/verify`, { verificationStatus, rejectionReason }),
  updateShopStatus: (id, status, reason) =>
    api.patch(`/admin/shops/${id}/status`, { status, reason }),
  deleteShop: (id) => api.delete(`/admin/shops/${id}`),
  getDocuments: (params) => api.get('/admin/documents', { params }),
  verifyBusinessDocument: (shopId, docType, data) =>
    api.patch(`/admin/shops/${shopId}/documents/${docType}/verify`, data),
  getRequests: (params) => api.get('/admin/requests', { params }),
  holdOrder: (id, onHold, reason) => api.patch(`/admin/orders/${id}/hold`, { onHold, reason }),
  getLogs: (params) => api.get('/admin/logs', { params }),
  clearLogs: () => api.delete('/admin/logs'),
};

export default api;
