export type Permission = 'full' | 'view' | 'none';

// Privileges live in the same matrix as the sections but answer a different
// question: not "can this role open Registro" but "what may it do once
// inside". They are granted or not — 'view' has no meaning for them, so the
// editor cycles these two columns between 'full' and 'none' only.
//
// Both default to 'none' for everyone but Admin, which is exactly the
// behaviour that shipped hard-coded: a tenant that saved its matrix before
// these columns existed must not silently hand a cashier the price.
export const PRIVILEGES = ['Precio', 'Eliminar', 'Asignados'] as const;
export type Privilege = (typeof PRIVILEGES)[number];

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
    Precio: 'full', Eliminar: 'full', Asignados: 'full',
  },
  Cajero: {
    Dashboard: 'view', Reservas: 'full', Registro: 'full', Clientes: 'full',
    Servicios: 'view', Inventario: 'none', Equipo: 'none', Reportes: 'none',
    Facturas: 'none', Plan: 'none', Config: 'none',
    Precio: 'none', Eliminar: 'none', Asignados: 'full',
  },
  Lavador: {
    Dashboard: 'view', Reservas: 'view', Registro: 'full', Clientes: 'none',
    Servicios: 'none', Inventario: 'none', Equipo: 'none', Reportes: 'none',
    Facturas: 'none', Plan: 'none', Config: 'none',
    Precio: 'none', Eliminar: 'none', Asignados: 'none',
  },
  Cliente: {
    Dashboard: 'none', Reservas: 'none', Registro: 'none', Clientes: 'none',
    Servicios: 'none', Inventario: 'none', Equipo: 'none', Reportes: 'none',
    Facturas: 'none', Plan: 'none', Config: 'none',
    Precio: 'none', Eliminar: 'none', Asignados: 'none',
  },
};
