import { test, expect } from '@playwright/test';

/**
 * Un link de correo vencido o ya usado responde 401, y el interceptor trataba
 * cualquier 401 como sesión vencida: borraba el storage y mandaba al login del
 * panel, donde a un cliente se le pide una contraseña que nunca tuvo. El
 * mensaje que la pantalla sí sabe mostrar no alcanzaba a verse porque el
 * navegador ya se había ido.
 *
 * Sin sesión a propósito: quien abre uno de estos links viene del correo.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test('un link de correo inválido explica el problema en vez de mandar al panel', async ({ page }) => {
  // 64 caracteres hex: pasa la validación de formato y muere en la búsqueda,
  // que es el 401 que nos interesa.
  await page.goto(`/m/${'a'.repeat(64)}`);

  await page.getByRole('button', { name: 'Continuar en el navegador' }).click();

  await expect(page.getByRole('alert')).toContainText(/link/i);
  await expect(page.getByRole('link', { name: 'Pedir otro link' })).toBeVisible();
  // Lo que no puede pasar: terminar en el login del panel.
  await expect(page).not.toHaveURL(/\/login$/);
});
