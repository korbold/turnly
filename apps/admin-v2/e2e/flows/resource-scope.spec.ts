import { test, expect, type APIRequestContext } from '@playwright/test';

import { authFor, STAFF_PASSWORD, TENANT } from '../fixtures/roles';

/**
 * Los vehículos y la búsqueda de clientes. Las rutas de client-resources las
 * comparten la app del cliente y el mostrador; con el id de un auto ajeno se
 * leía la cédula del dueño, y `clients/search` listaba la plataforma entera.
 */
const API = process.env.E2E_API_URL ?? 'https://api.staging.goturnly.com/api/v1';
const OTHER_CLIENT = 'cliente3@barberia-demo.staging.goturnly.com';

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

function headers(s: Session, tenant = true) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${s.token}`,
    ...(tenant ? { 'X-Tenant': TENANT } : {}),
  };
}

test.describe('vehículos y búsqueda de clientes', () => {
  let cajero: Session, cliente: Session;
  // Un auto del negocio que no es de cliente11.
  let ajeno: { id: string; plate: string };

  test.beforeAll(async ({ request }) => {
    cajero = await login(request, `cajero@${TENANT}.staging.goturnly.com`);
    cliente = await login(request, `cliente11@${TENANT}.staging.goturnly.com`);

    const res = await request.get(`${API}/client-resources?all=1&per_page=50`, { headers: headers(cajero) });
    expect(res.status()).toBe(200);
    // La placa vive en `data`, con la clave que el negocio configuró.
    const autos = (await res.json()).data as Array<{ id: string; client_id: string | null; data: Record<string, string> | null }>;
    const auto = autos.find((a) => a.client_id && a.client_id !== cliente.id && (a.data?.placa ?? a.data?.plate));
    expect(auto, 'un auto de otro cliente en el seed').toBeTruthy();
    ajeno = { id: auto!.id, plate: auto!.data!.placa ?? auto!.data!.plate };
  });

  test('el cliente no abre el auto de otro, con o sin negocio', async ({ request }) => {
    for (const tenant of [true, false]) {
      for (const suffix of ['', '/billing', '/history']) {
        const res = await request.get(`${API}/client-resources/${ajeno.id}${suffix}`, { headers: headers(cliente, tenant) });
        expect(res.status(), `GET ${suffix || '/'} tenant=${tenant}`).toBe(404);
      }
    }
  });

  test('el cliente no se queda con el auto de otro', async ({ request }) => {
    const res = await request.patch(`${API}/client-resources/${ajeno.id}`, {
      headers: headers(cliente, false),
      data: { client_id: cliente.id },
    });
    expect(res.status()).toBe(404);
  });

  test('el cliente no lista los autos del negocio ni busca por placa', async ({ request }) => {
    const lista = await request.get(`${API}/client-resources?all=1`, { headers: headers(cliente) });
    expect(lista.status()).toBe(403);

    const placa = await request.get(`${API}/client-resources/lookup?plate=${encodeURIComponent(ajeno.plate)}`, {
      headers: headers(cliente),
    });
    expect(placa.status()).toBe(403);
  });

  test('el cliente sigue viendo sus propios autos', async ({ request }) => {
    const res = await request.get(`${API}/client-resources`, { headers: headers(cliente) });
    expect(res.status()).toBe(200);
    for (const a of (await res.json()).data as Array<{ client_id: string }>) {
      expect(a.client_id).toBe(cliente.id);
    }
  });

  test('la búsqueda no lista gente de otro negocio por un pedazo, sí por el correo completo', async ({ request }) => {
    const pedazo = await request.get(`${API}/clients/search?q=barberia-demo`, { headers: headers(cajero) });
    expect(pedazo.status()).toBe(200);
    expect((await pedazo.json()).data).toHaveLength(0);

    const exacto = await request.get(`${API}/clients/search?q=${encodeURIComponent(OTHER_CLIENT)}`, {
      headers: headers(cajero),
    });
    const [persona] = (await exacto.json()).data;
    expect(persona?.email).toBe(OTHER_CLIENT);
    expect(persona?.tenant_relation).toBe('not_linked');
  });

  test.describe('el cajero en el panel', () => {
    test.use({ storageState: authFor('cajero') });

    test('ve la lista de clientes y abre un vehículo', async ({ page }) => {
      const lista = page.waitForResponse((r) => r.url().includes('/client-resources?') && r.request().method() === 'GET');
      await page.goto('/clients');
      expect((await lista).status()).toBe(200);

      const ficha = page.waitForResponse((r) => r.url().endsWith(`/client-resources/${ajeno.id}`));
      await page.goto(`/clients/${ajeno.id}`);
      expect((await ficha).status()).toBe(200);
    });
  });
});
