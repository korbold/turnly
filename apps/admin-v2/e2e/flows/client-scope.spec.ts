import { test, expect, type APIRequestContext } from '@playwright/test';

import { authFor, STAFF_PASSWORD, TENANT } from '../fixtures/roles';

/**
 * Un `client` del negocio —cualquiera que reservó una vez— pasaba como
 * personal: veía reservas ajenas y, con `users/*`, se subía a admin. El
 * cajero también podía subirse de rol o cambiarle la contraseña al dueño.
 * La API se ataca directo; el panel se abre para ver que el admin no perdió
 * lo suyo.
 */
const API = process.env.E2E_API_URL ?? 'https://api.staging.goturnly.com/api/v1';

type Session = { id: string; token: string };

async function login(request: APIRequestContext, identifier: string): Promise<Session> {
  const res = await request.post(`${API}/auth/login`, {
    data: { identifier, password: STAFF_PASSWORD },
    headers: { Accept: 'application/json' },
  });
  expect(res.ok(), `login de ${identifier}`).toBeTruthy();
  const { data } = await res.json();
  return { id: data.user.id, token: data.token };
}

function headers(s: Session) {
  return { Accept: 'application/json', Authorization: `Bearer ${s.token}`, 'X-Tenant': TENANT };
}

test.describe('roles dentro del negocio', () => {
  // Un login por cuenta: el login tiene rate limit por IP.
  let cajero: Session, cliente: Session;

  test.beforeAll(async ({ request }) => {
    cajero = await login(request, `cajero@${TENANT}.staging.goturnly.com`);
    cliente = await login(request, `cliente11@${TENANT}.staging.goturnly.com`);
  });

  test('el cliente no ve las reservas del negocio, sí las suyas', async ({ request }) => {
    const ajenas = await request.get(`${API}/reservations`, { headers: headers(cliente) });
    expect(ajenas.status()).toBe(403);

    const suyas = await request.get(`${API}/client/reservations`, { headers: headers(cliente) });
    expect(suyas.status()).toBe(200);
  });

  test('el cliente no se sube a admin', async ({ request }) => {
    const res = await request.patch(`${API}/users/${cliente.id}/role`, {
      headers: headers(cliente),
      data: { role: 'tenant_admin' },
    });
    expect(res.status()).toBe(403);
  });

  test('el cajero no se sube a admin ni toca la facturación', async ({ request }) => {
    const rol = await request.patch(`${API}/users/${cajero.id}/role`, {
      headers: headers(cajero),
      data: { role: 'tenant_admin' },
    });
    expect(rol.status()).toBe(403);

    const cert = await request.get(`${API}/settings/billing-cert`, { headers: headers(cajero) });
    expect(cert.status()).toBe(403);
  });

  test.describe('el admin en el panel', () => {
    test.use({ storageState: authFor('admin') });

    test('ve su equipo', async ({ page }) => {
      const users = page.waitForResponse((r) => r.url().includes('/users') && r.request().method() === 'GET');
      await page.goto('/team');
      expect((await users).status()).toBe(200);
    });

    test('abre el certificado del SRI', async ({ page }) => {
      await page.goto('/settings');
      const cert = page.waitForResponse((r) => r.url().includes('/settings/billing-cert'));
      await page.getByRole('tab', { name: 'Facturación' }).first().click();
      expect((await cert).status()).toBe(200);
      await expect(page.getByText('Certificado digital SRI')).toBeVisible();
    });
  });
});
