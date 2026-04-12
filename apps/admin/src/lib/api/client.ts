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

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
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
