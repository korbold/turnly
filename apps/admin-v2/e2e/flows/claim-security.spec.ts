import { test, expect, type APIRequestContext } from '@playwright/test';

import { STAFF_PASSWORD, TENANT } from '../fixtures/roles';

/**
 * El reclamo por QR/PIN devuelve un token que abre la cuenta entera. Hasta
 * noviembre de 2026 lo pedía cualquiera: sin login en `auth/claim/start`, y
 * desde `clients/{id}/invite-app` cualquier miembro del negocio —un cliente
 * que reservó una vez— para cualquier usuario de la plataforma.
 *
 * Son ataques contra la API, sin pantalla: el panel no usa estas rutas.
 * E2E_GHOST_ID es un walk-in sin reclamar de autospa-demo; el seed no los
 * crea, así que el caso feliz se salta si no viene.
 */
const API = process.env.E2E_API_URL ?? 'https://api.staging.goturnly.com/api/v1';
const OTHER_TENANT = 'barberia-demo';

async function login(request: APIRequestContext, identifier: string) {
  const res = await request.post(`${API}/auth/login`, {
    data: { identifier, password: STAFF_PASSWORD },
    headers: { Accept: 'application/json' },
  });
  expect(res.ok(), `login de ${identifier}`).toBeTruthy();
  const { data } = await res.json();
  return { id: data.user.id as string, token: data.token as string };
}

function inviteApp(request: APIRequestContext, token: string, tenant: string, userId: string) {
  return request.post(`${API}/clients/${userId}/invite-app`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant': tenant },
  });
}

type Session = { id: string; token: string };

test.describe('reclamo de cuentas', () => {
  // Un login por cuenta para todo el archivo: el login tiene rate limit por IP
  // y diez seguidos se ganan un 429 que no tiene nada que ver con el reclamo.
  let admin: Session, cajero: Session, cliente: Session, ajeno: Session;

  test.beforeAll(async ({ request }) => {
    admin = await login(request, `admin@${TENANT}.staging.goturnly.com`);
    cajero = await login(request, `cajero@${TENANT}.staging.goturnly.com`);
    cliente = await login(request, `cliente11@${TENANT}.staging.goturnly.com`);
    ajeno = await login(request, `admin@${OTHER_TENANT}.staging.goturnly.com`);
  });

  test('sin login, el QR/PIN no entrega la cuenta del admin', async ({ request }) => {
    const res = await request.post(`${API}/auth/claim/start`, {
      data: { identifier: `admin@${TENANT}.staging.goturnly.com`, method: 'qr_pin' },
      headers: { Accept: 'application/json' },
    });

    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.data?.token).toBeUndefined();
    expect(body.data?.pin).toBeUndefined();
  });

  test('sin login, el magic link sigue saliendo al correo', async ({ request }) => {
    const res = await request.post(`${API}/auth/claim/start`, {
      data: { identifier: `cliente11@${TENANT}.staging.goturnly.com`, method: 'magic_link' },
      headers: { Accept: 'application/json' },
    });

    expect(res.status()).toBe(200);
    expect((await res.json()).data.token).toBeUndefined();
  });

  test('un cliente del negocio no saca el PIN del admin', async ({ request }) => {

    const res = await inviteApp(request, cliente.token, TENANT, admin.id);
    expect(res.status()).toBe(403);
  });

  test('el dueño de otro negocio no saca el PIN de este admin', async ({ request }) => {

    const res = await inviteApp(request, ajeno.token, OTHER_TENANT, admin.id);
    expect(res.status()).toBe(404);
  });

  test('el cajero no saca el PIN de una cuenta ya reclamada', async ({ request }) => {

    const res = await inviteApp(request, cajero.token, TENANT, admin.id);
    expect(res.status()).toBe(422);
  });

  test('el cajero invita a su walk-in y el PIN abre esa cuenta', async ({ request }) => {
    const ghostId = process.env.E2E_GHOST_ID;
    test.skip(!ghostId, 'E2E_GHOST_ID no está definido');


    // El cliente tampoco puede invitar a un walk-in: el PIN es del personal.
    expect((await inviteApp(request, cliente.token, TENANT, ghostId!)).status()).toBe(403);

    const invite = await inviteApp(request, cajero.token, TENANT, ghostId!);
    expect(invite.status()).toBe(200);
    const { pin } = (await invite.json()).data;

    const verify = await request.post(`${API}/auth/claim/verify`, {
      data: { pin },
      headers: { Accept: 'application/json' },
    });
    expect(verify.status()).toBe(200);
    expect((await verify.json()).data.user.id).toBe(ghostId);
  });
});
