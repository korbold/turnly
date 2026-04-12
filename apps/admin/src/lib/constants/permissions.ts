type Permission = 'full' | 'view' | 'none';

interface RolePermissions {
  dashboard: Permission;
  reservations: Permission;
  'service-log': Permission;
  clients: Permission;
  services: Permission;
  team: Permission;
  reports: Permission;
  settings: Permission;
}

export const ROLE_PERMISSIONS: Record<string, RolePermissions> = {
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

export function getPermission(role: string | null, section: string): Permission {
  if (!role) return 'full'; // fallback for super admin or unknown
  return ROLE_PERMISSIONS[role]?.[section as keyof RolePermissions] ?? 'none';
}

export function canAccess(role: string | null, section: string): boolean {
  return getPermission(role, section) !== 'none';
}
