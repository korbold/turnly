import { test, expect } from '@playwright/test';

import { authFor } from '../fixtures/roles';

test.use({ storageState: authFor('cajero') });

test('el cajero entra al Registro Diario', async ({ page }) => {
  // La ruta real es /service-logs (plural): el directorio de routing en
  // src/app/(tenant)/ se llama así, aunque re-exporta desde
  // src/presentation/app/(tenant)/service-log/ (singular). /service-log sin
  // "s" cae en la ruta pública [slug] y nunca llega al panel.
  await page.goto('/service-logs');

  await expect(page.getByRole('button', { name: 'Registrar servicio' })).toBeVisible();
});
