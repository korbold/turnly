import axios from 'axios';
import { authStorage } from '../storage/auth-storage';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = authStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const tenantSlug = authStorage.getTenantSlug();
  if (tenantSlug) {
    config.headers['X-Tenant'] = tenantSlug;
  }
  return config;
});

let redirecting = false;

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED' || error.code === 'ECONNABORTED') {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && typeof window !== 'undefined' && !redirecting) {
      redirecting = true;
      authStorage.clear();
      window.location.href = '/login';
    }

    const data = error.response?.data;
    const message =
      data?.error?.message ?? data?.message ?? error.message ?? 'Error inesperado';
    const fieldErrors = data?.errors ?? null;
    return Promise.reject({ message, fieldErrors, status: error.response?.status });
  },
);

export default api;
