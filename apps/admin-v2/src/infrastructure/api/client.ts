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

    // Un 401 de estos endpoints no es una sesión vencida: es la respuesta.
    // "Este link ya se usó" llega como 401, y tratarlo como sesión vencida
    // borraba el storage y mandaba al cliente al login del panel, donde se le
    // pide una contraseña que nunca tuvo. El mensaje que la pantalla sí sabe
    // mostrar no alcanzaba a verse porque el navegador ya se había ido.
    const authEndpoints = ['/auth/login', '/auth/magic-link/verify', '/auth/google'];
    const isAuthAttempt = authEndpoints.some((url) => error.config?.url === url);

    if (error.response?.status === 401 && typeof window !== 'undefined' && !redirecting && !isAuthAttempt) {
      redirecting = true;
      authStorage.clear();
      // Customers live under /app and have their own passwordless login;
      // sending them to the staff panel's screen would ask them for a
      // password they never set. `/m/` es la misma persona: el link del correo.
      const path = window.location.pathname;
      const inPortal = path.startsWith('/app') || path.startsWith('/m/');
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
    const status = error.response?.status;

    // Laravel contesta el 429 con "Too Many Attempts.": en inglés, sin código
    // y sin decir cuánto esperar. Eso llegaba tal cual a la cara del cliente.
    // El `Retry-After` sí viene en la cabecera, así que se usa.
    const retryAfter = Number(error.response?.headers?.['retry-after'] ?? 0);
    const waitHint =
      retryAfter > 60
        ? ` Vuelve a intentar en ${Math.ceil(retryAfter / 60)} minutos.`
        : retryAfter > 0
          ? ` Vuelve a intentar en ${retryAfter} segundos.`
          : ' Espera unos minutos y vuelve a intentar.';

    const message =
      status === 429
        ? `Demasiados intentos.${waitHint}`
        : (data?.error?.message ?? data?.message ?? error.message ?? 'Error inesperado');
    const code = data?.error?.code ?? (status === 429 ? 'TOO_MANY_ATTEMPTS' : null);
    const fieldErrors = data?.errors ?? null;
    // El cuerpo entero del error, no sólo su mensaje: hay respuestas que
    // traen con qué actuar. `DUPLICATE_PLATE` devuelve cuál es el vehículo
    // que ya existe para poder seleccionarlo, y aplanar a {message, code} lo
    // tiraba a la basura.
    const details = data?.error ?? null;
    return Promise.reject({ message, code, fieldErrors, details, status });
  },
);

export default api;
