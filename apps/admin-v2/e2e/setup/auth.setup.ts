import { test as setup, expect } from '@playwright/test';

import { ROLES } from '../fixtures/roles';

/**
 * Entra una vez por rol y guarda el estado. El panel guarda el token Y el
 * slug del tenant en `localStorage`, así que el storageState alcanza: los
 * specs arrancan adentro, sin repetir el login en cada test.
 */
for (const role of ROLES) {
  setup(`sesión de ${role.name}`, async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Usuario o correo').fill(role.identifier);
    // exact: true evita el choque con el botón "Mostrar/Ocultar contraseña",
    // cuyo aria-label también contiene la palabra "contraseña".
    await page.getByLabel('Contraseña', { exact: true }).fill(role.password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    // No se afirma una ruta concreta: el destino depende del rol y de la
    // matriz. Lo que importa es haber salido del login.
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 30_000,
    });

    await expect(page.getByText('Iniciar sesión')).toHaveCount(0);

    await page.context().storageState({ path: role.storageState });
  });
}
