/**
 * Las cuentas que siembra `staging:seed`. Un login por rol, con el correo
 * que arma el comando: `{rol}@{slug}.staging.goturnly.com`.
 *
 * La contraseña no es un secreto: staging es un sandbox y el propio seed la
 * imprime al terminar. Tratarla como secreto sólo agrega ceremonia.
 */
export const TENANT = 'autospa-demo';
export const STAFF_PASSWORD = 'staging1234';

export type RoleName = 'cajero' | 'admin';

export type Role = {
  name: RoleName;
  identifier: string;
  password: string;
  storageState: string;
};

export const ROLES: readonly Role[] = [
  {
    name: 'cajero',
    identifier: `cajero@${TENANT}.staging.goturnly.com`,
    password: STAFF_PASSWORD,
    storageState: 'e2e/.auth/cajero.json',
  },
  {
    name: 'admin',
    identifier: `admin@${TENANT}.staging.goturnly.com`,
    password: STAFF_PASSWORD,
    storageState: 'e2e/.auth/admin.json',
  },
] as const;

export function authFor(name: RoleName): string {
  const role = ROLES.find((r) => r.name === name);
  if (!role) {
    throw new Error(`Rol desconocido: ${name}`);
  }
  return role.storageState;
}
