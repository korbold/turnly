export type Permission = 'full' | 'view' | 'none';

// Matrix is keyed by DISPLAY role names (matches the Permisos editor and
// ROLE_TO_MATRIX in use-permissions.ts) × section names.
//
// New sections default to 'none' for every role but Admin: a tenant that
// saved its matrix before the section existed must not silently gain
// access to it. The owner grants it explicitly in Configuración →
// Permisos.
export const DEFAULT_PERMISSIONS: Record<string, Record<string, Permission>> = {
  Admin: {
    Dashboard: 'full', Reservas: 'full', Registro: 'full', Clientes: 'full',
    Servicios: 'full', Inventario: 'full', Equipo: 'full', Reportes: 'full',
    Facturas: 'full', Plan: 'full', Config: 'full',
  },
  Cajero: {
    Dashboard: 'view', Reservas: 'full', Registro: 'full', Clientes: 'full',
    Servicios: 'view', Inventario: 'none', Equipo: 'none', Reportes: 'none',
    Facturas: 'none', Plan: 'none', Config: 'none',
  },
  Lavador: {
    Dashboard: 'view', Reservas: 'view', Registro: 'full', Clientes: 'none',
    Servicios: 'none', Inventario: 'none', Equipo: 'none', Reportes: 'none',
    Facturas: 'none', Plan: 'none', Config: 'none',
  },
  Cliente: {
    Dashboard: 'none', Reservas: 'none', Registro: 'none', Clientes: 'none',
    Servicios: 'none', Inventario: 'none', Equipo: 'none', Reportes: 'none',
    Facturas: 'none', Plan: 'none', Config: 'none',
  },
};
