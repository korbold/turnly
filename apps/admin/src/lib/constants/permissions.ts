export type Permission = 'full' | 'view' | 'none';

export interface RolePermissions {
  dashboard: Permission;
  reservations: Permission;
  'service-log': Permission;
  clients: Permission;
  services: Permission;
  team: Permission;
  reports: Permission;
  settings: Permission;
}

export type PermissionsConfig = Record<string, RolePermissions>;

// Default permissions — used when tenant hasn't customized them
export const DEFAULT_PERMISSIONS: PermissionsConfig = {
  tenant_admin: {
    dashboard: 'full',
    reservations: 'full',
    'service-log': 'full',
    clients: 'full',
    services: 'full',
    team: 'full',
    reports: 'full',
    settings: 'full',
  },
  cashier: {
    dashboard: 'full',
    reservations: 'full',
    'service-log': 'full',
    clients: 'view',
    services: 'none',
    team: 'none',
    reports: 'full',
    settings: 'none',
  },
  washer: {
    dashboard: 'full',
    reservations: 'view',
    'service-log': 'none',
    clients: 'none',
    services: 'none',
    team: 'none',
    reports: 'none',
    settings: 'none',
  },
};

export const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'reservations', label: 'Reservaciones' },
  { key: 'service-log', label: 'Registro del día' },
  { key: 'clients', label: 'Clientes' },
  { key: 'services', label: 'Servicios' },
  { key: 'team', label: 'Equipo' },
  { key: 'reports', label: 'Reportes' },
  { key: 'settings', label: 'Configuración' },
];

export const EDITABLE_ROLES = [
  { key: 'cashier', label: 'Cajero', color: 'text-blue-700' },
  { key: 'washer', label: 'Operador', color: 'text-green-700' },
];

// Merge custom permissions over defaults
export function mergePermissions(custom?: PermissionsConfig | null): PermissionsConfig {
  if (!custom) return DEFAULT_PERMISSIONS;
  return {
    tenant_admin: DEFAULT_PERMISSIONS.tenant_admin, // admin always full
    cashier: { ...DEFAULT_PERMISSIONS.cashier, ...custom.cashier },
    washer: { ...DEFAULT_PERMISSIONS.washer, ...custom.washer },
  };
}

export function getPermission(
  role: string | null,
  section: string,
  customPermissions?: PermissionsConfig | null,
): Permission {
  if (!role) return 'full';
  const perms = mergePermissions(customPermissions);
  return perms[role]?.[section as keyof RolePermissions] ?? 'none';
}

export function canAccess(
  role: string | null,
  section: string,
  customPermissions?: PermissionsConfig | null,
): boolean {
  return getPermission(role, section, customPermissions) !== 'none';
}

export function cyclePermission(current: Permission): Permission {
  if (current === 'full') return 'view';
  if (current === 'view') return 'none';
  return 'full';
}
