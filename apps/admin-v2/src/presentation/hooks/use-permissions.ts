'use client';

import { useMe } from '@/presentation/hooks/use-auth';
import { useSettings } from '@/presentation/hooks/use-settings';
import type { UserRole } from '@/domain/entities/user';
import { DEFAULT_PERMISSIONS } from '@/shared/constants/permissions';

// Maps UserRole code → permissions matrix display key
const ROLE_TO_MATRIX: Partial<Record<UserRole, string>> = {
  tenant_admin: 'Admin',
  cashier: 'Cajero',
  washer: 'Lavador',
  client: 'Cliente',
};

// Maps sidebar href → permissions matrix section key. Anything missing
// here is ungrantable: restricted roles (washer/cashier) never see it,
// no matter what the owner ticks in the matrix.
const HREF_TO_SECTION: Record<string, string | undefined> = {
  '/dashboard': 'Dashboard',
  '/reservations': 'Reservas',
  '/service-logs': 'Registro',
  '/clients': 'Clientes',
  '/services': 'Servicios',
  '/inventory': 'Inventario',
  '/team': 'Equipo',
  '/reports': 'Reportes',
  '/facturas': 'Facturas',
  '/plan': 'Plan',
  '/settings': 'Config',
};

const RESTRICTED_ROLES: UserRole[] = ['washer', 'cashier'];

export function usePermissions() {
  const { data: me } = useMe();
  const { data: settings } = useSettings();

  function canAccess(href: string): boolean {
    const role = me?.user?.role;

    // Owner and admin always have full access.
    if (!role || role === 'owner' || role === 'tenant_admin') return true;

    // Clients should never access the admin panel.
    if (role === 'client') return false;

    // For restricted roles, check the matrix.
    if (RESTRICTED_ROLES.includes(role)) {
      const matrixKey = ROLE_TO_MATRIX[role];
      if (!matrixKey) return false;

      const section = HREF_TO_SECTION[href];
      // Section not in matrix (inventory, plan) → hide for restricted roles.
      if (!section) return false;

      const permission =
        settings?.permissions?.[matrixKey]?.[section]
        ?? DEFAULT_PERMISSIONS[matrixKey]?.[section]
        ?? 'none';
      return permission === 'full' || permission === 'view';
    }

    return true;
  }

  return { canAccess };
}
