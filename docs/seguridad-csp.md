# Política de contenido de la web

## Corrección de las alertas CSP

La CSP se genera en `apps/frontend/src/proxy.ts` por pedido, con 16 bytes
aleatorios como nonce. Se sobrescriben los headers de entrada antes de
reenviarlos a Next. La respuesta publica la política y usa `private, no-store`.
El layout espera una conexión real: las páginas de la aplicación se renderizan
por pedido y no reutilizan HTML estático con un nonce anterior.

En producción `script-src` usa nonce y `strict-dynamic`, sin `unsafe-inline`
ni `unsafe-eval`; `script-src-attr` es `none`. La autorización de scripts
creados por código de confianza es parte de `strict-dynamic`, por lo que el
control de inyección modifica el HTML antes del parser del navegador.

`style-src` admite el nonce y los hashes de la hoja vacía transitoria y de la
hoja fija que inyecta Sonner. El control negativo comprueba que una hoja vacía
autorizada no permita agregar CSS arbitrario después. El hash del CSS fijo
se calcula desde el módulo instalado al compilar; si cambia el formato
de la inyección, la configuración falla y exige revisar la integración.
`style-src-attr` usa `unsafe-hashes` con una lista de valores SSR completos
de next/image, la barra lateral shadcn y las páginas de error de Next 16.4.1.
No se permite cualquier atributo de estilo. Los cambios de esas librerías
deben comprobarse con los controles CSP del navegador.

Radix obtiene el nonce mediante `get-nonce`, declarado como dependencia
directa. El proveedor cliente lo establece antes de los efectos de los
componentes. Conserva el nonce del documento inicial: un refresh RSC puede
traer otro valor, pero no cambia la CSP del documento que ya está abierto.
El viewport de Select recibe además el nonce explícito que requiere Radix
para su hoja propia. No se cambian colores, tokens ni la estructura visual.

En desarrollo se conservan las excepciones necesarias para HMR y depuración;
las comprobaciones de seguridad se ejecutan sobre el build de producción.

## Configuración de imágenes y despliegue

`img-src` admite recursos del propio origen, `data:`, `blob:` y exclusivamente
el origen de `NEXT_PUBLIC_STORAGE_URL`. Se eliminó el permiso para cualquier
servidor HTTPS. La URL se valida sin credenciales; solo se admite HTTPS o HTTP
para los hosts locales utilizados por la prueba.

Configurar en `apps/frontend/.env` el origen público que devuelve Storage:

```dotenv
NEXT_PUBLIC_STORAGE_URL=https://proyecto.supabase.co
```

Debe corresponder al `SUPABASE_PUBLIC_URL` del backend o, en su ausencia, a
`SUPABASE_URL`. No lleva la service role key ni tokens. Para Docker Compose,
declarar la misma variable en el `.env` de la raíz o en el entorno de Compose.
El Dockerfile la recibe como argumento de build. Es configuración pública que
queda incorporada al build, por lo que cambiarla requiere reconstruir el
frontend. Sin configurarla, las imágenes externas quedan bloqueadas.

El entorno local del usuario se configuró copiando únicamente ese origen
público desde su configuración existente, sin copiar claves del backend.

## Verificación

```powershell
pnpm front typecheck
pnpm front lint
pnpm back test:seguridad:zap --csp
```

La última orden prepara infraestructura y proveedores descartables, compila
producción y ejecuta los cuatro escenarios de regresión web y cuatro controles
CSP antes de ZAP: nonce y scripts, componentes/navegación, bloqueo de contenido
inyectado e imágenes del Storage permitido frente a otro origen. Los ocho
deben pasar antes de iniciar los escaneos. La imagen de Storage es un PNG
servido por el proveedor local; no requiere acceder al Storage compartido.

Las evidencias nuevas quedan en `acceptance/resultados/zap-csp/`, separadas
de la corrida original de ZAP. El reporte de Playwright queda en
`acceptance/resultados/web/`. Los resultados se consolidan al completar la
corrida; las tres alertas bajas de aislamiento del navegador son un pendiente
separado de esta corrección de CSP. No se repite ni se acredita carga k6 por
este cambio de renderizado.

### Verificación local del 05/11/2026

Tipos, ESLint y compilación de producción aprobados. Playwright aprobó **8/8**
en 19,1 segundos, incluidos menú móvil, selector, alta en línea de administrador,
navegación después de guardar y refresh, sin infracciones CSP en esos flujos.
Los cuatro escenarios previos de idempotencia, conflicto y responsive también
aprobaron. Se inspeccionaron visualmente las capturas de 375 y 1440 px.

El baseline con la misma versión e imagen de ZAP dejó **0 alertas CSP** y
conservó las tres bajas de COEP/COOP/CORP. No se filtraron alertas ni se
deshabilitaron reglas para conseguir ese resultado. Las excepciones de
desarrollo no forman parte de esta verificación de producción.

El activo autenticado de la API volvió a terminar con código ZAP 0, sin alertas
de riesgo bajo o superior en las mismas 13 operaciones. Las comprobaciones de
sesión antes/después y de alta con 201 aprobaron. La
[evidencia resumida](evidencias/zap-csp-2026-11-05.json) conserva los resultados,
los ocho tests y hashes de reportes y fuentes. Las pruebas anteriores que
detectaron incompatibilidades no se cuentan como corridas aprobadas.
