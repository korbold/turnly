export type Permission = 'full' | 'view' | 'none';

// Matrix is keyed by DISPLAY role names (matches the Permisos editor and
// ROLE_TO_MATRIX in use-permissions.ts) × section names.
export const DEFAULT_PERMISSIONS: Record<string, Record<string, Permission>> = {
  Admin: {
    Dashboard: 'full', Reservas: 'full', Registro: 'full', Clientes: 'full',
    Servicios: 'full', Equipo: 'full', Reportes: 'full', Config: 'full',
  },
  Cajero: {
    Dashboard: 'view', Reservas: 'full', Registro: 'full', Clientes: 'full',
    Servicios: 'view', Equipo: 'none', Reportes: 'none', Config: 'none',
  },
  Lavador: {
    Dashboard: 'view', Reservas: 'view', Registro: 'full', Clientes: 'none',
    Servicios: 'none', Equipo: 'none', Reportes: 'none', Config: 'none',
  },
  Cliente: {
    Dashboard: 'none', Reservas: 'none', Registro: 'none', Clientes: 'none',
    Servicios: 'none', Equipo: 'none', Reportes: 'none', Config: 'none',
  },
};
