import { test, expect, type Page } from '@playwright/test';

const api = process.env.ACEPTACION_BASE_URL!;
async function entrar(page: Page, email: string) {
  const r = await page.request.post(api + '/auth/login', { data: { email, password: process.env.SEED_PASSWORD } });
  expect(r.ok()).toBeTruthy();
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'domus_session')?.httpOnly).toBe(true);
}

test('C7 web: el conflicto conserva el borrador y exige recarga explícita', async ({ page, context }) => {
  await entrar(page, 'super@example.test');
  const otra = await context.newPage();
  const ruta = '/consorcios/' + process.env.ACEPTACION_CONSORCIO_ID;
  await page.goto(ruta); await otra.goto(ruta);
  await expect(page.getByLabel('Nombre', { exact: true })).toBeVisible();
  await expect(otra.getByLabel('Nombre', { exact: true })).toBeVisible();
  await page.getByLabel('Nombre', { exact: true }).fill('Edición de la primera pestaña');
  await otra.getByLabel('Nombre', { exact: true }).fill('Borrador de la segunda pestaña');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page).toHaveURL('/');
  let escrituras = 0;
  otra.on('request', (r) => { if (r.method() === 'PATCH') escrituras++; });
  await otra.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(otra.getByText('El consorcio cambió. Tu borrador se conserva;', { exact: false })).toBeVisible();
  await expect(otra.getByLabel('Nombre', { exact: true })).toHaveValue('Borrador de la segunda pestaña');
  expect(escrituras).toBe(1);
  await otra.getByRole('button', { name: 'Recargar y descartar borrador' }).click();
  await expect(otra.getByLabel('Nombre', { exact: true })).toHaveValue('Edición de la primera pestaña');
});

test('C6 web: perder una respuesta no crea otro reclamo al reintentar', async ({ page }) => {
  await entrar(page, 'carga0@example.test');
  await page.goto('/vecino/reclamos/nuevo');
  await page.getByRole('radio', { name: 'Mantenimiento', exact: true }).click();
  await page.locator('#titulo').fill('Reintento desde la web');
  await page.locator('#descripcion').fill('Prueba de respuesta perdida después del commit del reclamo.');
  let id: string | undefined;
  const claves: string[] = [];
  await page.route('**/api/reclamos', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    claves.push(route.request().headers()['idempotency-key']);
    if (!id) {
      const r = await route.fetch(); expect(r.status()).toBe(201); id = (await r.json()).id;
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Enviar reclamo', exact: true }).click();
  await expect(page.getByText('No se pudo enviar el reclamo.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Enviar reclamo', exact: true }).click();
  await expect(page).toHaveURL('/vecino/reclamos/' + id);
  expect(claves).toHaveLength(2); expect(claves[0]).toBeTruthy(); expect(claves[1]).toBe(claves[0]);
});

for (const ancho of [375, 1440]) test(`UI: formulario a ${ancho}px`, async ({ page }, info) => {
  await page.setViewportSize({ width: ancho, height: 900 });
  await entrar(page, 'super@example.test');
  await page.goto('/consorcios/' + process.env.ACEPTACION_CONSORCIO_ID);
  await expect(page.getByLabel('Nombre', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`consorcio-${ancho}.png`), fullPage: true });
});
