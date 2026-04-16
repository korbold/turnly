const KEYS = {
  token: 'auth_token',
  tenantSlug: 'tenant_slug',
  isSuperAdmin: 'is_super_admin',
  superAdminMode: 'super_admin_mode',
} as const;

function get(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

function set(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
}

function getBool(key: string): boolean {
  return get(key) === 'true';
}

function setBool(key: string, value: boolean): void {
  set(key, String(value));
}

export const authStorage = {
  getToken: () => get(KEYS.token),
  setToken: (token: string) => set(KEYS.token, token),

  getTenantSlug: () => get(KEYS.tenantSlug),
  setTenantSlug: (slug: string) => set(KEYS.tenantSlug, slug),

  getIsSuperAdmin: () => getBool(KEYS.isSuperAdmin),
  setIsSuperAdmin: (value: boolean) => setBool(KEYS.isSuperAdmin, value),

  getSuperAdminMode: () => getBool(KEYS.superAdminMode),
  setSuperAdminMode: (value: boolean) => setBool(KEYS.superAdminMode, value),

  clear: () => {
    if (typeof window === 'undefined') return;
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
};
