import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const tenantSlug = localStorage.getItem('tenant_slug');
    if (tenantSlug) {
      config.headers['X-Tenant'] = tenantSlug;
    }
  }
  return config;
});

let redirecting = false;

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Don't transform cancellation/abort errors — React Query needs the original to detect aborts
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED' || error.code === 'ECONNABORTED') {
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && typeof window !== 'undefined' && !redirecting) {
      redirecting = true;
      localStorage.removeItem('auth_token');
      localStorage.removeItem('tenant_slug');
      window.location.href = '/login';
    }
    const data = error.response?.data;
    // Laravel validation errors (422) come in data.errors / data.message
    // App errors come in data.error.message
    const message =
      data?.error?.message ??
      data?.message ??
      error.message ??
      'Error inesperado';
    const fieldErrors = data?.errors ?? null;
    return Promise.reject({ message, fieldErrors, status: error.response?.status });
  }
);

export default api;
