import { test, expect, type Browser, type Page } from '@playwright/test';

/**
 * Escenarios críticos de punta a punta (eje A: al menos 5 en el pipeline).
 * Cada uno recorre la interfaz real contra la API real, con base y broker de
 * aceptación, y verifica el resultado del lado de quien lo consume.
 *
 *   1. HU 09  Ingreso por formulario: cada rol a su portal; error genérico; sin acceso cruzado.
 *   2. HU 01  Vecino paga su boleta con Mercado Pago (simulado) y la ve pagada.
 *   3. HU 15  Administración registra una transferencia y el vecino ve la boleta pagada.
 *   4. HU 04/05  Vecino abre un reclamo; la administración lo toma; el vecino ve el cambio.
 *   5. HU 13  Superadministrador da de alta un consorcio y queda en el listado.
 *
 * Usan unidades propias (carga40 a carga49) para no pisar otras pruebas.
 */

const api = process.env.ACEPTACION_BASE_URL!;
const password = process.env.SEED_PASSWORD!;
const proveedorUrl = process.env.ACEPTACION_PROVEEDOR_URL;
const unico = () => Math.random().toString(36).slice(2, 8);

async function ingresar(page: Page, email: string, clave = password, { esperarIngreso = true } = {}) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  // Hasta que el login responde y redirige, la cookie de sesión no existe.
  if (esperarIngreso) await expect(page).not.toHaveURL(/\/login/);
}

async function nuevaSesion(browser: Browser, email: string, consorcioDeAceptacion = false) {
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  if (consorcioDeAceptacion) await enConsorcioDeAceptacion(page);
  await ingresar(page, email);
  return { page, cerrar: () => contexto.close() };
}

/** El portal de administración recuerda el consorcio activo en el navegador: se fija el de aceptación. */
async function enConsorcioDeAceptacion(page: Page) {
  const id = process.env.ACEPTACION_CONSORCIO_ID;
  expect(id, 'Falta ACEPTACION_CONSORCIO_ID').toBeTruthy();
  await page.addInitScript((valor) => localStorage.setItem('domus.consorcioActivo', valor), id!);
}

test.describe('flujos críticos', () => {
  test('HU 09: cada rol entra a su portal, el error no distingue y no hay acceso cruzado', async ({ page, browser }) => {
    await ingresar(page, 'carga40@example.test');
    await expect(page).toHaveURL(/\/vecino$/);

    // El vecino no puede abrir el portal de administración.
    await page.goto('/admin/cobranzas');
    await expect(page).not.toHaveURL(/\/admin/);

    const admin = await nuevaSesion(browser, 'admin@example.test', true);
    await expect(admin.page).toHaveURL(/\/admin$/);
    await admin.cerrar();

    const ajeno = await browser.newContext();
    const intento = await ajeno.newPage();
    await ingresar(intento, 'ajeno@example.test', 'una-clave-incorrecta', { esperarIngreso: false });
    await expect(intento.getByText('Email o contraseña incorrectos')).toBeVisible();
    await expect(intento).toHaveURL(/\/login/);
    await ingresar(intento, 'no-existe@example.test', 'una-clave-incorrecta', { esperarIngreso: false });
    await expect(intento.getByText('Email o contraseña incorrectos')).toBeVisible();
    await ajeno.close();
  });

  test('HU 01: el vecino paga con Mercado Pago y vuelve con la boleta pagada', async ({ page }) => {
    test.skip(!proveedorUrl, 'Falta ACEPTACION_PROVEEDOR_URL (simulador de Mercado Pago)');
    await ingresar(page, 'carga41@example.test');
    await page.goto('/vecino/expensas');
    await page.getByRole('link', { name: /^Pagar \$/ }).click();
    await expect(page.getByRole('heading', { name: 'Pagar expensas' })).toBeVisible();

    // El checkout real es externo: se intercepta la redirección y se simula el pago aprobado.
    await page.route('http://checkout.example.test/**', (ruta) => ruta.fulfill({ body: 'checkout simulado' }));
    // La página redirige apenas recibe la preferencia: se lee la respuesta al pasar.
    let preferencia: { status: number; pagoId?: string } | undefined;
    await page.route('**/api/pagos/mercadopago/preferencia', async (ruta) => {
      const respuesta = await ruta.fetch();
      preferencia = { status: respuesta.status(), ...(await respuesta.json()) };
      await ruta.fulfill({ response: respuesta });
    });
    await page.getByRole('button', { name: /^Pagar \$/ }).click();
    await expect.poll(() => preferencia?.status).toBe(201);
    const pagoId = preferencia!.pagoId!;
    await expect(page).toHaveURL(/checkout\.example\.test/);
    const pago = await (await page.request.get(`${api}/pagos/${pagoId}`)).json();

    const aprobado = { id: 990000001, status: 'approved', status_detail: 'accredited', external_reference: pagoId,
      transaction_amount: Number(pago.monto), date_approved: new Date().toISOString(), payment_method_id: 'visa',
      card: { last_four_digits: '4242' } };
    const busqueda = `search?external_reference=${encodeURIComponent(pagoId)}&sort=date_created&criteria=desc`;
    const control = await page.request.post(`${proveedorUrl}/__control`, {
      data: { modo: 'ok', pagos: { [busqueda]: { results: [aprobado] }, [String(aprobado.id)]: aprobado } },
    });
    expect(control.ok()).toBeTruthy();

    // Vuelta del checkout, como la arma Mercado Pago.
    await page.goto(`/vecino/expensas/pago?pago=aprobado&external_reference=${pagoId}&payment_id=${aprobado.id}`);
    await expect(page.getByText('Pago aprobado')).toBeVisible();

    const boleta = await (await page.request.get(`${api}/pagos/${pagoId}`)).json();
    expect(boleta.estado).toBe('APROBADO');
    await page.request.post(`${proveedorUrl}/__control`, { data: { modo: 'ok', pagos: {} } });
  });

  test('HU 15: la administración registra una transferencia y el vecino ve la boleta pagada', async ({ page, browser }) => {
    // Cada vecino de prueba tiene varias unidades: se usa la que el portal le muestra como activa.
    const vecino = await nuevaSesion(browser, 'carga42@example.test');
    const encabezado = await vecino.page.getByRole('button', { name: /· Unidad / }).first().innerText();
    const unidad = /Unidad\s+(Unidad \d+)/.exec(encabezado.replace(/\s+/g, ' '))![1];

    await enConsorcioDeAceptacion(page);
    await ingresar(page, 'admin@example.test');
    await page.goto('/admin/cobranzas');
    await page.getByRole('searchbox', { name: 'Buscar unidad o propietario' }).fill(unidad);
    await page.getByRole('button', { name: 'Buscar' }).click();
    const fila = page.getByRole('row', { name: new RegExp(`^${unidad} `) });
    await expect(fila).toHaveCount(1);
    await fila.getByRole('button', { name: 'Registrar pago' }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: /Registrar/ }).last().click();
    await expect(dialogo).toBeHidden();
    await expect(fila.getByText('Pagado')).toBeVisible();

    await vecino.page.goto('/vecino/expensas');
    await expect(vecino.page.getByRole('link', { name: /^Pagar \$/ })).toHaveCount(0);
    await vecino.cerrar();
  });

  test('HU 04/05: el vecino abre un reclamo, la administración lo toma y el vecino ve el cambio', async ({ page, browser }) => {
    const titulo = `Pérdida de agua E2E ${unico()}`;
    await ingresar(page, 'carga43@example.test');
    await page.goto('/vecino/reclamos/nuevo');
    await page.getByRole('radio', { name: 'Mantenimiento' }).click();
    await page.getByLabel('Título').fill(titulo);
    await page.getByLabel('Descripción').fill('Hay una pérdida en la cocina desde ayer. Prueba de punta a punta.');
    await page.getByRole('button', { name: 'Enviar reclamo' }).click();
    await expect(page).toHaveURL(/\/vecino\/reclamos\/[0-9a-f-]{36}$/);
    const reclamoUrl = page.url();
    await expect(page.getByText(titulo)).toBeVisible();

    const admin = await nuevaSesion(browser, 'admin@example.test', true);
    await admin.page.goto('/admin/reclamos');
    await admin.page.getByText(titulo).first().click();
    await expect(admin.page.getByRole('heading', { name: titulo })).toBeVisible();
    await admin.page.getByRole('button', { name: 'Estado', exact: true }).click();
    await admin.page.getByRole('menuitem', { name: 'Pasar a en curso' }).click();
    const dialogo = admin.page.getByRole('dialog');
    await dialogo.getByLabel('Mensaje (opcional)').fill('Ya mandamos a revisar la pérdida.');
    await dialogo.locator('button[type="submit"]').click();
    await expect(dialogo).toBeHidden();
    await admin.cerrar();

    await page.goto(reclamoUrl);
    await expect(page.getByText('En curso', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Nuevo', { exact: true })).toHaveCount(0);
    // El mensaje del cambio de estado le llega al vecino en la línea de tiempo.
    await expect(page.getByText('Ya mandamos a revisar la pérdida.')).toBeVisible();
  });

  test('HU 13: el superadministrador da de alta un consorcio con un administrador nuevo, que lo ve en su portal', async ({ page, browser }) => {
    const sufijo = unico();
    const nombre = `Edificio E2E ${sufijo}`;
    const emailAdmin = `admin-${sufijo}@example.test`;
    await ingresar(page, 'super@example.test');
    await page.goto('/consorcios/nuevo');
    await page.getByLabel('Nombre', { exact: true }).first().fill(nombre);

    await page.getByRole('button', { name: '+ Crear administrador' }).click();
    await page.getByLabel('Nombre', { exact: true }).nth(1).fill('Ana');
    await page.getByLabel('Apellido').fill('Prueba');
    await page.getByLabel('Email').fill(emailAdmin);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Crear y asignar' }).click();
    await expect(page.getByRole('combobox', { name: 'Administrador asignado' })).toContainText('Ana');

    await page.getByLabel('Calle').fill('Av. Libertador');
    await page.getByLabel('Número').fill('1234');
    await page.getByRole('button', { name: 'Crear consorcio' }).click();
    await expect(page).not.toHaveURL(/\/consorcios\/nuevo/);
    await page.goto('/');
    await expect(page.getByText(nombre)).toBeVisible();

    // El administrador nuevo entra y lo tiene como consorcio activo.
    const nuevo = await nuevaSesion(browser, emailAdmin);
    await expect(nuevo.page).toHaveURL(/\/admin$/);
    await expect(nuevo.page.getByRole('button', { name: new RegExp(`Consorcio activo ${nombre}`) })).toBeVisible();
    await nuevo.cerrar();
  });
});
