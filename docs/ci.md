# Integración continua de versiones

El workflow `.github/workflows/ci.yml` se ejecuta únicamente al subir un tag
cuyo nombre empiece con `v`, por ejemplo `v1.0.0`. No se ejecuta por pushes
a ramas ni por pull requests. Publicar una Release para un tag que ya existe
no dispara otra ejecución: el disparador es el push del tag.

Cada ejecución descarga el commit del tag, instala las dependencias con el
lockfile y ejecuta nueve verificaciones independientes:

| Verificación | Comando |
|---|---|
| Tipos del backend y frontend | `pnpm typecheck` |
| ESLint del frontend | `pnpm front lint` |
| Pruebas habituales (`src/**/*.spec.ts` en backend) | `pnpm test` |
| Compilación del backend y frontend | `pnpm build` |
| Timeouts y cancelación de proveedores simulados | `pnpm back test:aceptacion:proveedores` |
| Contrato de errores Problem Details | `pnpm back test:aceptacion:errores` |
| Duplicados y entregas inciertas de email | `pnpm back test:aceptacion:email` |
| Integración con PostgreSQL y RabbitMQ reales locales | `pnpm back test:aceptacion:docker` |
| API integral, navegador y carga k6 | `pnpm back test:aceptacion:integral --web --carga` |

Las pruebas web se ejecutan con Playwright desde el runner integral, con
sesiones reales mediante cookie httpOnly. No se incorporan a `pnpm test`.
El backend se analiza con TypeScript; no tiene ESLint configurado.

Se usa Node.js 22 y la versión de pnpm declarada en `package.json`.
Las verificaciones no despliegan la aplicación ni requieren secretos de
producción. La compilación del frontend necesita acceso a Google Fonts.
`db:verify` sigue siendo una comprobación previa al commit según `AGENTS.md`;
no forma parte de este workflow porque consulta la base compartida.

Las suites nuevas de aceptación no están incluidas en `pnpm test`: por eso
se ejecutan explícitamente en la matriz. Cada job conserva su salida como
artefacto `resultados-<id>` durante 30 días, también cuando falla. El pipeline
usa Bash con `pipefail`: guardar la salida con `tee` no oculta errores.

La integración usa Docker Compose del runner Ubuntu y
`apps/backend/acceptance/compose.yml`, con credenciales efímeras generadas
por el script. Levanta sus propios PostgreSQL y RabbitMQ, aplica el esquema
mínimo y la migración de outbox necesarios para las pruebas, e incluye
rollback, deduplicación, DLQ/reproceso y reinicio del publicador durante una
caída del broker. Elimina ese entorno al terminar. No lee `.env`, no necesita
secrets de Supabase y no hace escrituras en la base compartida. La prueba
DLQ incluye tres esperas reales de 30 segundos; los jobs tienen un límite
de 30 minutos.

El job integral restaura un snapshot de esquema sin datos, aplica migraciones
pendientes, genera 50 identidades y datos ficticios (500 unidades, 3000 boletas
y 500 reclamos), compila el backend en Docker y prueba la API real. Instala
Chromium y verifica idempotencia y conflictos en la web; finalmente ejecuta
k6 durante cinco minutos con 50 usuarios. Conserva el resumen JSON y capturas
sin guardar contraseñas, cookies ni tokens. Los proveedores de pagos, Storage
y SMTP son simuladores locales; no se realizan cobros ni envíos reales.

La configuración del workflow no acredita una ejecución de GitHub Actions:
para eso se necesita un tag que incluya estos cambios y sus nueve jobs verdes.
El estado de aceptación y sus límites están en
[`aceptacion-integracion-resiliencia.md`](aceptacion-integracion-resiliencia.md).

## Publicar una versión

1. Incorporar el workflow mediante PR a `develop` y promover la versión estable
   a `main` mediante PR.
2. Crear un tag sobre el SHA del commit de entrega que incluya el workflow:

   ```bash
   git tag -a v1.0.0 <SHA_DEL_COMMIT> -m "Entrega v1.0.0"
   git push origin v1.0.0
   ```

3. En GitHub → Actions, abrir `CI de versión` y comprobar que los nueve jobs
   estén en verde para ese tag. Guardar el enlace de la ejecución como evidencia.
4. Opcionalmente publicar una GitHub Release seleccionando ese mismo tag.

La trazabilidad queda como versión → commit → ejecución de CI → resultados.
El tag por sí solo no garantiza que las verificaciones hayan aprobado. Si hay
fallas de código, corregirlas mediante el flujo de PR y crear una nueva versión,
sin mover el tag de una entrega anterior.
