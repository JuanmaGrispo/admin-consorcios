# Seguridad de dependencias

## DEF-10 — actualización de Next.js (05/11/2026)

Se actualizaron `next` y `eslint-config-next` de `16.2.12` a `16.4.1`, con
versiones exactas y lockfile regenerado mediante pnpm 9.12.0. La auditoría
previa reportaba hallazgos de Next cuyo rango corregido comienza en `16.4.1`.
Los otros cambios del lockfile corresponden a la resolución de dependencias
transitivas y peers de estos dos paquetes; se conservaron las demás
dependencias directas del frontend y los importers del resto del monorepo.

### Verificación local

| Comprobación | Resultado |
|---|---|
| Versión instalada de Next | `16.4.1` |
| `pnpm front typecheck` | Aprobado |
| `pnpm front lint` | Aprobado |
| `pnpm front build` | Aprobado, compilación de producción con Turbopack |
| `pnpm audit --prod --json` | Sin hallazgos para el paquete `next`; persisten hallazgos en otras dependencias |
| `pnpm back test:aceptacion:integral --web` | Aprobado; Playwright 4/4 |

Tipos, lint y compilación se ejecutaron en Windows con Node.js 26.7.0.
El entorno integral utiliza el backend del repo en Docker con Node.js 22,
PostgreSQL y RabbitMQ descartables, y proveedores HTTP/SMTP simulados.

La corrida integral aprobó HTTP 11/11 antes y después del reinicio, negocio
2/2, consumidores 2/2 por proceso, recuperación tras caída del broker y
compensación de Storage con backend activo y en mantenimiento. Playwright
aprobó conflicto entre pestañas, reintento tras perder la respuesta de un
reclamo confirmado y formulario sin desbordamiento horizontal a 375 y 1440 px.
La carga k6 no se repitió para este cambio.

El primer intento no pudo iniciar los cuatro escenarios web por falta del
ejecutable de Chromium en el equipo. Se instaló con
`pnpm front exec playwright install chromium` y se repitió la corrida integral
completa, que terminó con código 0. El primer fallo de preparación se conserva
en su propio log y no se cuenta como una corrida aprobada.

**Estado de DEF-10:** remediación de Next y verificación local completadas.
El resto de las dependencias se corrigió el mismo día por la tarde (ver la
sección siguiente): DEF-10 queda cerrado en local. La ejecución de CI
sobre un tag de entrega continúa como pendiente separado.

### Alcance de la auditoría

La auditoría de dependencias declaradas como producción comprende todo el
monorepo. Antes de la actualización informó 76 vulnerabilidades: 6 críticas,
33 altas, 31 moderadas y 6 bajas. Después informó 58: 1 crítica, 26 altas,
26 moderadas y 5 bajas, con **0 hallazgos para `next`**. Los conteos son los
devueltos por pnpm; no representan necesariamente vulnerabilidades explotables
en los flujos de Domus ni equivalen a cantidad de paquetes afectados.

El comando sigue indicando vulnerabilidades. Entre los pendientes figura
`proxy-addr`, reportado como crítico por la auditoría
([GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)).
Estos hallazgos requieren revisión de alcance y correcciones separadas.
Esta actualización no acredita OWASP ZAP, revisión defensiva de endpoints,
Quality Gate, pruebas manuales ni ejecución de GitHub Actions.

La evidencia local queda en
`apps/backend/acceptance/resultados/def-10-auditoria.json` y
`apps/backend/acceptance/def-10-integral-final.log`, ignorados por git. El primer
intento queda en `apps/backend/acceptance/def-10-integral.log`. El resumen
de auditoría conserva fecha, comando, código de salida y avisos restantes,
sin credenciales. Las evidencias de navegador del runner se guardan en
`apps/backend/acceptance/resultados/web/`.

## DEF-10 — resto de las dependencias (05/11/2026, tarde)

`pnpm audit --prod` después de Next 16.4.1 seguía con 1 crítica y 26 altas.
Vienen de dos fuentes:

- **Backend (7, incluida la crítica):** `proxy-addr` 2.0.7, `body-parser` 2.3.0
  y `multer` 2.2.0 llegan por `@nestjs/platform-express` y Express;
  `brace-expansion` 2.1.4, por TypeORM. La versión de NestJS que ya trae todo
  corregido es la 12, un cambio de versión mayor; la última 11 (11.2.8) sigue
  con `multer` 2.4.0.
- **Frontend (el resto):** la CLI de `shadcn` estaba declarada como
  dependencia de producción y arrastra `undici`, `fast-uri`, `js-yaml`,
  `@modelcontextprotocol/sdk`, `zod` y otras. La app sólo la usa en el
  `@import 'shadcn/tailwind.css'` de `globals.css`, que se resuelve al compilar.

### Cambios

- `overrides` de pnpm en el `package.json` raíz con las versiones corregidas,
  todas dentro de la misma versión mayor: `proxy-addr` ^2.0.8, `body-parser`
  ^2.4.0, `multer` ^2.5.0 y `brace-expansion` 2.x ^2.1.7. Se sumaron también
  las de dependencias de desarrollo que se corrigen con un parche: `fast-uri`,
  `js-yaml` 4.x, `brace-expansion` 1.x y 5.x, `source-map-js`, `undici` 7.x,
  `systeminformation` y `@modelcontextprotocol/sdk`.
- `shadcn` pasó a `devDependencies` del frontend. El Dockerfile instala las
  dependencias de desarrollo para compilar, así que el build no cambia.

### Resultado

| Auditoría | Críticas | Altas | Moderadas | Bajas |
|---|---|---|---|---|
| `--prod`, antes | 1 | 26 | 26 | 5 |
| `--prod`, después | 0 | 0 | 9 | 0 |
| Incluyendo desarrollo, después | 0 | 1 | 18 | 1 |

La alta que queda contando desarrollo es `zod` 3.25.76 dentro de la CLI de
shadcn (`@modelcontextprotocol/sdk`). Se corrige sólo con `zod` 4, una versión
mayor que esa CLI no admite. Se acepta como riesgo mitigado: la CLI se usa sólo
al agregar componentes con `npx shadcn`, no forma parte del build ni de la
imagen y no recibe entradas de usuarios.

### Verificación

| Comprobación | Resultado |
|---|---|
| `pnpm back test` | 517/517 |
| `pnpm typecheck` | Aprobado (backend y frontend) |
| `nest build` | Aprobado |
| `pnpm front lint` | Aprobado |
| `flujos-criticos.e2e.ts` | 5/5 |
| Subida con `multer` 2.5.0 (`POST /archivos?destino=reclamos`) | PNG válido 201; binario con `Content-Type` de imagen 400; archivo de más de 2 MB 400 |

Pendiente: compilar el frontend de producción en un equipo con acceso a
Google Fonts (`docker compose up --build`). En el entorno donde se verificó no
había salida a `fonts.googleapis.com`.

Resumen estructurado: [`evidencias/dependencias-2026-11-05.json`](evidencias/dependencias-2026-11-05.json).
