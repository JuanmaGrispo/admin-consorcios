import { test, expect, type Page } from '@playwright/test';

/**
 * Responsive (criterio de la cátedra y RNF 09): las pantallas principales de
 * los tres portales se usan sin desplazamiento horizontal a 360, 768 y 1280 px.
 * Deja una captura por pantalla y ancho como evidencia en resultados/web.
 */
const ANCHOS = [360, 768, 1280] as const;
const api = process.env.ACEPTACION_BASE_URL!;

const PANTALLAS: { nombre: string; usuario?: string; ruta: string }[] = [
  { nombre: 'login', ruta: '/login' },
  { nombre: 'plataforma-consorcios', usuario: 'super@example.test', ruta: '/' },
  { nombre: 'admin-panel', usuario: 'admin@example.test', ruta: '/admin' },
  { nombre: 'admin-cobranzas', usuario: 'admin@example.test', ruta: '/admin/cobranzas' },
  { nombre: 'admin-reclamos', usuario: 'admin@example.test', ruta: '/admin/reclamos' },
  { nombre: 'admin-unidades', usuario: 'admin@example.test', ruta: '/admin/unidades' },
  { nombre: 'vecino-inicio', usuario: 'carga0@example.test', ruta: '/vecino' },
  { nombre: 'vecino-expensas', usuario: 'carga0@example.test', ruta: '/vecino/expensas' },
  { nombre: 'vecino-reclamo-nuevo', usuario: 'carga0@example.test', ruta: '/vecino/reclamos/nuevo' },
];

async function entrar(page: Page, email: string) {
  const r = await page.request.post(api + '/auth/login', { data: { email, password: process.env.SEED_PASSWORD } });
  expect(r.ok(), `login de ${email}`).toBeTruthy();
}

for (const pantalla of PANTALLAS) {
  for (const ancho of ANCHOS) {
    test(`responsive: ${pantalla.nombre} a ${ancho}px sin scroll horizontal`, async ({ page }, info) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      if (pantalla.usuario) await entrar(page, pantalla.usuario);
      await page.goto(pantalla.ruta);
      // networkidle da tiempo a que carguen tablas y tableros; en modo dev el login nunca
      // queda en silencio (HMR), así que se acota la espera y se exige el contenido principal.
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
      await expect(page.locator('main').first()).toBeVisible();
      // Si la sesión no alcanzó, la app manda al login: eso sería un falso positivo.
      if (pantalla.usuario) await expect(page).not.toHaveURL(/\/login/);
      const medida = await page.evaluate(() => ({ contenido: document.documentElement.scrollWidth, ventana: window.innerWidth }));
      await page.screenshot({ path: info.outputPath(`${pantalla.nombre}-${ancho}.png`), fullPage: true });
      expect(medida.contenido, `${pantalla.nombre} a ${ancho}px: el contenido mide ${medida.contenido}px`).toBeLessThanOrEqual(medida.ventana);
    });
  }
}
