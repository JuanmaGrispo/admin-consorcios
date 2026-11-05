import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    infracciones: string[];
    scriptInyectado?: boolean;
  }
}

test.describe('CSP de producción', () => {
  test.skip(process.env.ACEPTACION_CSP !== 'SI', 'Requiere el frontend de producción del runner ZAP');

  test('nonce nuevo, scripts autorizados e imágenes locales sin bloqueos', async ({ page }) => {
    const primera = await page.goto('/login');
    const csp = primera!.headers()['content-security-policy'];
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/img-src[^;]* https:/);
    expect(primera!.headers()['cache-control']).toContain('no-store');
    expect(await page.locator('script').evaluateAll((scripts) => scripts.every((s) => Boolean(s.nonce)))).toBe(true);
    const otra = await page.request.get('/login', { headers: { 'x-nonce': 'elegido-por-el-cliente', 'Content-Security-Policy': "script-src 'unsafe-inline'" } });
    const nuevo = otra.headers()['content-security-policy'].match(/'nonce-([^']+)'/)?.[1];
    expect(nuevo).toBeTruthy(); expect(nuevo).not.toBe(nonce); expect(nuevo).not.toBe('elegido-por-el-cliente');
    await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();
    await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0));
  });

  test('la sesión, el selector y el menú móvil funcionan sin infracciones CSP', async ({ page }) => {
    await page.addInitScript(() => {
      window.infracciones = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        window.infracciones.push(e.effectiveDirective + ': ' + e.blockedURI + ': ' + e.sample);
      });
    });
    const login = await page.request.post(process.env.ACEPTACION_BASE_URL + '/auth/login', {
      data: { email: 'super@example.test', password: process.env.SEED_PASSWORD },
    });
    expect(login.status()).toBe(200);
    await page.goto('/consorcios/' + process.env.ACEPTACION_CONSORCIO_ID);
    await expect(page.getByLabel('Nombre', { exact: true })).toBeVisible();
    await page.getByRole('combobox').first().click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Crear administrador', exact: false }).click();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.setViewportSize({ width: 375, height: 900 });
    await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByLabel('Nombre', { exact: true }).fill('Nonce después de guardar');
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(page).toHaveURL('/');
    await page.locator(`a[href="/consorcios/${process.env.ACEPTACION_CONSORCIO_ID}"]`).click();
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Nonce después de guardar');
    await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    const infracciones = await page.evaluate(() => window.infracciones);
    if (infracciones.length) console.log(await page.locator('style').evaluateAll((styles) => styles.map((style) => ({ nonce: Boolean(style.nonce), css: style.textContent?.slice(0, 120) }))));
    expect(infracciones).toEqual([]);
  });

  test('bloquea scripts y CSS inyectados sin autorización', async ({ page }) => {
    // Simula HTML inyectado antes del parser. Un script añadido desde
    // page.evaluate es código de confianza para strict-dynamic y no prueba XSS.
    await page.route('**/login', async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace('</head>', '<script>window.scriptInyectado = true</script></head>');
      await route.fulfill({ response, body });
    });
    await page.goto('/login');
    await page.evaluate(() => {
      const estilo = document.createElement('style');
      estilo.textContent = 'body { --css-inyectado: permitido; }'; document.head.append(estilo);
      const vacio = document.createElement('style'); document.head.append(vacio);
      vacio.textContent = 'body { --css-posterior: permitido; }';
      const elemento = document.createElement('div'); elemento.id = 'prueba-csp';
      elemento.setAttribute('style', 'position:fixed;z-index:999999'); document.body.append(elemento);
    });
    expect(await page.evaluate(() => (window as Window & { scriptInyectado?: boolean }).scriptInyectado)).toBeUndefined();
    expect(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--css-inyectado'))).toBe('');
    expect(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--css-posterior'))).toBe('');
    await expect(page.locator('#prueba-csp')).not.toHaveCSS('position', 'fixed');
  });

  test('permite la imagen del Storage configurado y bloquea otro origen', async ({ page }) => {
    await page.goto('/login');
    const resultado = await page.evaluate(async (storage) => {
      const cargar = (src: string) => new Promise<boolean>((resolve) => {
        const imagen = new Image(); imagen.onload = () => resolve(true); imagen.onerror = () => resolve(false);
        imagen.src = src; document.body.append(imagen);
      });
      return [await cargar(storage + '/storage/v1/object/public/domus/csp.png'), await cargar('http://127.0.0.1:1/no-autorizada.png')];
    }, process.env.NEXT_PUBLIC_STORAGE_URL!);
    expect(resultado).toEqual([true, false]);
  });
});
