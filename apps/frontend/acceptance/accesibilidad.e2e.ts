import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

/**
 * Accesibilidad (criterio de la cátedra: WCAG 2.2 AA sin violaciones críticas).
 * axe revisa cada pantalla de los tres portales con las reglas de WCAG 2.0,
 * 2.1 y 2.2, niveles A y AA. Falla con cualquier violación, no sólo las
 * críticas: contraste, nombres accesibles, ARIA inválido, regiones con scroll
 * que no se pueden usar con el teclado. El login y las pantallas principales
 * del vecino se revisan también a 360 px, donde cambian la navegación y los menús.
 */
const api = process.env.ACEPTACION_BASE_URL!;
const SUPER = 'super@example.test';
const ADMIN = 'admin@example.test';
const VECINO = 'carga0@example.test';

const PANTALLAS: { usuario?: string; ruta: string; anchos: number[] }[] = [
  { ruta: '/login', anchos: [1280, 360] },
  { usuario: SUPER, ruta: '/', anchos: [1280] },
  { usuario: SUPER, ruta: '/consorcios/nuevo', anchos: [1280] },
  ...['', '/asambleas', '/catalogos', '/cobranzas', '/liquidaciones', '/notificaciones', '/novedades', '/reclamos',
    '/reservas', '/unidades', '/vecinos', '/votaciones'].map((r) => ({ usuario: ADMIN, ruta: '/admin' + r, anchos: [1280] })),
  // A 360 px cambian la navegación inferior y los menús: se repiten las pantallas
  // del vecino que más se usan desde el celular (el 25/11 dieron igual en las 25).
  ...['', '/asambleas', '/expensas', '/notificaciones', '/novedades', '/perfil', '/reclamos', '/reclamos/nuevo', '/reservas']
    .map((r) => ({ usuario: VECINO, ruta: '/vecino' + r, anchos: ['', '/expensas', '/reclamos/nuevo', '/reservas'].includes(r) ? [1280, 360] : [1280] })),
];

async function entrar(page: Page, email: string) {
  const r = await page.request.post(api + '/auth/login', { data: { email, password: process.env.SEED_PASSWORD } });
  expect(r.ok(), `login de ${email}`).toBeTruthy();
}

for (const pantalla of PANTALLAS) {
  for (const ancho of pantalla.anchos) {
    test(`accesibilidad: ${pantalla.ruta} a ${ancho}px sin violaciones WCAG 2.2 AA`, async ({ page }, info) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      if (pantalla.usuario) await entrar(page, pantalla.usuario);
      await page.goto(pantalla.ruta);
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
      await expect(page.locator('main').first()).toBeVisible();
      if (pantalla.usuario) await expect(page).not.toHaveURL(/\/login/);

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      await info.attach('axe.json', { body: JSON.stringify(violations, null, 2), contentType: 'application/json' });

      const resumen = violations.map(
        (v) => `${v.impact} ${v.id} (${v.nodes.length}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n    ')}`,
      );
      expect(violations, `${pantalla.ruta} a ${ancho}px:\n  ${resumen.join('\n  ')}`).toEqual([]);
    });
  }
}
