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

/** Roles that run the business, as opposed to operating it day to day.
    Money-shaped decisions — what a service costs, whether a record ever
    existed — belong to them and are not part of the permissions matrix:
    the matrix grants sections, not privileges inside a section. */
const MANAGER_ROLES: UserRole[] = ['owner', 'tenant_admin'];

export function usePermissions() {
  const { data: me } = useMe();
  const { data: settings } = useSettings();

  const role = me?.user?.role;
  // Undefined while /me is in flight — treat as restricted so the price
  // field never flashes editable for a cashier on a slow connection.
  const isManager = !!role && MANAGER_ROLES.includes(role);

  function canAccess(href: string): boolean {
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

  return { canAccess, isManager };
}
