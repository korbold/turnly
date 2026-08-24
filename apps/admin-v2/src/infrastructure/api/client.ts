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

    if (error.response?.status === 401 && typeof window !== 'undefined' && !redirecting && error.config?.url !== '/auth/login') {
      redirecting = true;
      authStorage.clear();
      // Customers live under /app and have their own passwordless login;
      // sending them to the staff panel's screen would ask them for a
      // password they never set.
      const inPortal = window.location.pathname.startsWith('/app');
      const target = inPortal ? '/app/login' : '/login';
      // Redirecting to the page we are already on reloads it, which
      // re-fires the same request: an endless refresh.
      if (window.location.pathname !== target) {
        window.location.href = target;
      } else {
        redirecting = false;
      }
    }

    const data = error.response?.data;
    const message =
      data?.error?.message ?? data?.message ?? error.message ?? 'Error inesperado';
    const code = data?.error?.code ?? null;
    const fieldErrors = data?.errors ?? null;
    // El cuerpo entero del error, no sólo su mensaje: hay respuestas que
    // traen con qué actuar. `DUPLICATE_PLATE` devuelve cuál es el vehículo
    // que ya existe para poder seleccionarlo, y aplanar a {message, code} lo
    // tiraba a la basura.
    const details = data?.error ?? null;
    return Promise.reject({ message, code, fieldErrors, details, status: error.response?.status });
  },
);

export default api;
