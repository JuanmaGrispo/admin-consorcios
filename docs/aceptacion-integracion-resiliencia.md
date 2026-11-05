# Aceptación de integración y resiliencia

Estado al 03/11/2026: C1–C8 verificados localmente, con el límite de SMTP
aceptado explícitamente. C9 no aprobado: se omiten más corridas por decisión
del usuario y se conserva una referencia orientativa basada en mediciones
reales. Ver «Cierre acordado» al final. CI está preparado para el próximo tag;
todavía no hay evidencia
de ejecución de esa versión en GitHub Actions. Los resultados históricos de
abajo no sustituyen este estado actual.

Actualización al 05/11/2026: C9 se cumplió en dos corridas completas de cinco
minutos, con el pool de conexiones en 10 y en 30. Ver «Medición con pool
configurable» al final. Sigue pendiente acreditarlo en GitHub Actions.

La matriz y las primeras ejecuciones conservan el diagnóstico original. La
sección «Correcciones» al final describe el estado posterior; no confundir
pruebas de componente aprobadas con aceptación integral del sistema.

El workflow de versión incorpora explícitamente proveedores, Problem Details,
email e infraestructura Docker. Se dispara únicamente por tags `v*`, sin
ejecuciones en PR. Conserva logs por job durante 30 días; la configuración
se validó localmente, pero falta obtener la ejecución del próximo tag como
evidencia de GitHub Actions. API completa, web y carga se agregaron al job
integral con fixtures automáticos; ver [`ci.md`](ci.md).

SOAP queda fuera del alcance. Este documento define objetivos de aceptación;
la existencia de código o de pruebas unitarias no acredita su cumplimiento.

La especificación para cerrar los pendientes está en
[`2026-10-30-cierre-integracion-resiliencia.md`](superpowers/specs/2026-10-30-cierre-integracion-resiliencia.md).
Define contratos, pruebas integrales y evidencia de cierre. El avance posterior
del 02/11/2026 figura al final y reemplaza los pendientes del diagnóstico inicial.

## Matriz de aceptación

| ID | Criterio y prueba | Evidencia requerida | Estado inicial |
|---|---|---|---|
| C1 | Proveedor REST demora más de 5 s: cancelar dentro de un presupuesto total de 5 s, incluidos reintentos; informar indisponibilidad o alternativa definida. No repetir efectos externos. | Prueba con proveedor simulado, tiempo observado y respuesta HTTP. | Pendiente: existen timeouts de 10–30 s. |
| C2 | Apagar RabbitMQ, crear una operación con evento, reiniciar backend y levantar RabbitMQ. El evento debe llegar sin intervención y el negocio permanecer consistente. | IDs del recurso/evento, registro outbox y efecto final del consumidor. | Parcial: reconexión y persistencia en broker; pendientes en memoria, sin outbox. |
| C3 | Entregar el mismo evento secuencialmente y en paralelo: un único efecto por consumidor. Repetir tras reiniciar. | Conteo en base y, para email, en el proveedor de prueba. | Parcial: deduplicación transaccional en muro/bandeja; ventana de duplicación en SMTP. |
| C4 | Enviar JSON inválido y evento válido cuyo handler falla: inválido a DLQ; válido agota tres reintentos y llega a DLQ. Corregir causa y reprocesar conservando evento_id. | Mensaje en DLQ, error registrado, intentos y efecto del reproceso. | Parcial: lógica unitaria cubierta; falta acreditar broker y reproceso. |
| C5 | Inyectar un fallo después de la primera escritura de una operación y antes de terminar: rollback completo, sin evento publicable. Si hubo efecto externo, compensación documentada. | Estado antes/después y ejecución con base real de prueba. | Parcial: hay transacciones; falta prueba integral y outbox. |
| C6 | POST /reclamos repetido y concurrente con igual Idempotency-Key y contenido: mismo estado, cuerpo e ID; exactamente una fila. Repetir tras reinicio. Otra carga con esa clave responde 409. | Suite HTTP, conteo en base y repetición tras reinicio. | Pendiente de implementación. |
| C7 | Dos clientes leen GET /consorcios/:id; primero actualiza con If-Match y segundo usa el ETag viejo: 412 y sin sobrescritura. | Suite HTTP y lectura final. | Pendiente de implementación. |
| C8 | Errores con application/problem+json, type, title, status e instance, sin detalles internos. Validar 400/401/403/404/409/412/422/429/5xx donde correspondan; no inventar rutas para producir códigos. | Suite HTTP más escenarios controlados de permisos, límites y fallos. | Pendiente: filtro actual usa otro formato. |
| C9 | 50 usuarios concurrentes durante 5 minutos, en tres endpoints críticos: p95 < 500 ms y errores < 1 % por endpoint. | Resumen k6, versión del código, entorno y volumen de datos. | Pendiente de ejecución. |

## Entorno y ejecución

Usar backend y base exclusivos de prueba, un broker local y proveedores simulados.
No ejecutar pruebas de escritura ni carga contra Supabase compartido o producción.
Las credenciales se pasan por entorno y no se incluyen en reportes.

Comandos desde la raíz:

```powershell
pnpm back test
pnpm back test:aceptacion
pnpm back test:aceptacion:proveedores
pnpm back test:aceptacion:errores
pnpm back test:aceptacion:email
pnpm back test:aceptacion:docker
k6 run --summary-export resultados-carga.json apps/backend/acceptance/carga.js
```

La suite HTTP exige estas variables; si faltan, falla en lugar de aprobar sin probar:

- `ACEPTACION_BASE_URL`: URL del backend de prueba, incluido `/api`.
- `ACEPTACION_TOKEN`: bearer de un superadmin de prueba.
- `ACEPTACION_ESCRITURA=SI`: confirma uso de fixtures descartables.
- `ACEPTACION_RECLAMO_JSON`: JSON válido con categoriaId, unidadId, titulo y descripcion.
- `ACEPTACION_CONSORCIO_ID`: consorcio descartable que puede renombrarse.
- `ACEPTACION_DATABASE_URL`: base local `domus_aceptacion` con el esquema
  completo de la aplicación y los fixtures; C6 cuenta las filas creadas.

Para probar persistencia de C6, definir `ACEPTACION_REPETIR_CLAVE` (hasta 60
caracteres), ejecutar, reiniciar el backend y ejecutar de nuevo conservando
esa clave y el mismo `ACEPTACION_RECLAMO_JSON`. La prueba exige que la base
siga conteniendo un único recurso. No reiniciar ni borrar la base entre esas
dos ejecuciones. La API de aceptación debe estar en localhost o 127.0.0.1.

La prueba crea reclamos y renombra el consorcio fixture; recrear los fixtures entre
ejecuciones. No borra datos automáticamente. El token se usa únicamente desde Node.
Estas pruebas no involucran la sesión web ni cambian su cookie httpOnly.

Para la corrida reproducible, usar `pnpm back test:aceptacion:integral --web --carga`.
El runner prepara `CARGA_BASE_URL`, `CARGA_FIXTURES` y 50 sesiones efímeras;
elimina el archivo de identidades al terminar. Se evalúan GET /boletas,
GET /boletas/:id y POST /reclamos. Cada creación usa una clave distinta.

## Suites y alcance de la automatización

La suite HTTP comprueba C6, C7 y parte de C8 contra una API real. Debe fallar
contra la implementación actual hasta completar los contratos. Cuenta filas
para C6; el reinicio entre corridas aún se hace explícitamente y no valida
todos los códigos de C8 en endpoints reales.
El script k6 comprueba C9 cuando se ejecuta en el entorno preparado.
| Archivo en `apps/backend/acceptance/` | Cobertura y límites |
|---|---|
| `proveedores.test.cjs` | C1: ejecuta MercadoPagoClient y ArchivosClient con HTTP real local que tarda 6,5 s. Conserva AbortSignal y mide tiempo, cancelación, respuesta 503 y cantidad de solicitudes. Credenciales simuladas; nunca llama al proveedor real. |
| `infraestructura.test.cjs` | C2: apaga broker dedicado y mata el proceso publicador con una publicación pendiente; reconstruye el cliente y exige recuperar el evento. Es diagnóstico de durabilidad del publicador, no una prueba completa de negocio + outbox. C3: diez entregas concurrentes a BandejaRepository y reconstrucción de conexión. C4: JSON inválido, cuatro intentos reales separados por TTL de 30 s, DLQ y reproceso confirmado. C5: error PostgreSQL después de escribir la marca de evento y trigger que falla al escribir la timeline de un reclamo; verifica rollback de ambas operaciones. |
| `email.test.cjs` | C3: pruebas de componente de duplicados secuenciales, concurrentes y fallo después de enviar antes de registrar ENVIADO. Usa almacenamiento y proveedor en memoria para inyectar los fallos; no acredita SMTP ni persistencia real. |
| `http.test.cjs` | C6–C8: contratos observados a través de la API real con fixtures descartables. |
| `errores.test.cjs` | C8: contrato del filtro real para doce códigos, con request/response controlados. No demuestra que cada endpoint elija el código correcto. |
| `carga.js` | C9: tres endpoints, 50 usuarios, cinco minutos, umbrales por endpoint de latencia, errores y checks funcionales. |

### Infraestructura autocontenida

Con Docker Desktop iniciado, `pnpm back test:aceptacion:docker` crea las
credenciales efímeras, levanta `compose.yml`, ejecuta la suite y elimina sus
contenedores al terminar. No necesita `.env`. Usa el proyecto `domus-aceptacion`
y los puertos locales 55432 y 55672. No ejecutar dos instancias simultáneas.
La primera ejecución descarga las imágenes. La prueba DLQ demora alrededor de
90 segundos por los tres TTL reales; no se acortan los tiempos de producción.

Si pnpm no está disponible, desde `apps/backend`:

```powershell
node --require ts-node/register/transpile-only --test acceptance/proveedores.test.cjs
node --require ts-node/register/transpile-only --test acceptance/errores.test.cjs
node --require ts-node/register/transpile-only --test acceptance/email.test.cjs
node acceptance/ejecutar-infraestructura.cjs
```

El esquema mínimo de PostgreSQL existe únicamente dentro de la prueba y se
elimina al finalizar. Se usa metadata real y repositories de producción, con
`synchronize: false`; no se modifican las entities generadas. No replica todas
las FK, restricciones y módulos de Supabase: validar estos contratos no certifica
todos los flujos transaccionales del sistema.

### Qué falta para acreditar la aceptación completa

Además de pasar las suites, C2 exige repetir el escenario desde una operación
de negocio con outbox y verificar consistencia en base. C3 requiere entrega
SMTP/proveedor real de prueba, y deduplicación del muro. C5 requiere ampliar
los fallos a expensas, pagos y reservas y documentar sus compensaciones.
C6 requiere repetir la suite con clave estable tras reiniciar backend.
Para C6–C9 hace falta un backend con esquema completo y fixtures descartables;
el compose de infraestructura mínima no levanta una aplicación completa.

## Orden de cierre

1. Contratos REST: Problem Details, idempotencia persistida y versiones con ETag.
2. Outbox y transacciones: migraciones, regeneración de entities y publicador.
3. Consumidores, deduplicación concurrente, DLQ y comando de reproceso.
4. Presupuesto de timeout y proveedores simulados.
5. Automatización de fallos, corrida integral y carga; actualizar esta matriz.

Cada resultado debe registrar fecha, commit, comando, entorno, cantidad de pruebas,
fallos y archivo de evidencia. No guardar tokens, cookies ni datos personales.
Antes de un commit que modifique el esquema, ejecutar `pnpm back db:verify`.

## Verificación inicial — 30/10/2026

- TypeScript del backend: aprobado con el compilador local (`tsc --noEmit`).
- Sintaxis de suite HTTP y script k6: aprobada con `node --check`.
- Suite existente del backend: ejecución completada con fallos HTTP por
  conexiones locales rechazadas con `EACCES` en este entorno. No se acredita
  aprobación completa ni se atribuyen esos fallos a un defecto de la aplicación.
- Suite HTTP de aceptación: tres pruebas detenidas por falta de
  `ACEPTACION_BASE_URL`; no se probaron los contratos contra una API.
- Carga: no ejecutada; k6 no está instalado y faltan fixtures de prueba.
- Los comandos pnpm no pudieron arrancar: Corepack intentó descargar pnpm
  9.12.0 y la resolución de registry.npmjs.org falló. Para las verificaciones
  locales se utilizaron directamente Node y las dependencias instaladas.
- No se modificó el esquema ni se ejecutaron pruebas sobre la base compartida.

## Ejecución de escenarios adicionales — 30/10/2026

- C1: cuatro operaciones contra HTTP local real tardaron aproximadamente
  6,6 segundos; ninguna canceló a los 5 s. Fallan los cuatro casos y el check
  de cancelación, como se esperaba con los timeouts actuales de 10–30 s.
- C3 email: el duplicado secuencial pasa; los escenarios concurrente y de
  fallo al registrar confirmación producen dos envíos en lugar de uno.
- C8 filtro: fallan los doce casos de formato Problem Details. El filtro
  actual conserva códigos y oculta el error interno, pero no cumple el formato.
- Esos fallos representan brechas del código actual; no se corrigieron las
  expectativas para producir una suite verde artificialmente.
- PostgreSQL local real: pasan los cuatro escenarios de entregas concurrentes,
  reconstrucción de conexión, rollback de marca/notificación y rollback del
  cambio de estado de reclamo cuando falla su timeline.
- Pruebas HTTP existentes: 12/12 aprobadas al permitir conexiones locales.
  Se confirma que los EACCES de la primera corrida eran del entorno.
- TypeScript vuelve a pasar. La base Supabase pausada no fue utilizada.
- Infraestructura local: ejecución final completada en unos 148 s, con 8
  pruebas aprobadas y 1 fallida (el runner incluye los grupos en ese conteo).
  C4 aprobado: inválido a DLQ sin handler; evento válido falla cuatro veces,
  agota tres reintentos reales de 30 s, llega a DLQ y se reprocesa con el mismo
  evento_id y un solo efecto exitoso.
- C2 fallido: con el broker detenido se encoló una publicación en un proceso
  hijo, se lo terminó, se reinició el broker y se reconstruyó RabbitClient.
  No se recibió el evento durante los 15 s de observación después de recuperar
  conectividad. Esto evidencia la ausencia de almacenamiento durable del
  pendiente en ese publicador, no un fallo de conectividad de Supabase.
- Los contenedores del proyecto `domus-aceptacion` se eliminaron al terminar;
  no se detuvieron los contenedores de la aplicación del usuario.
- Evidencia local (ignorada por git por extensión `.log`):
  `apps/backend/acceptance/infraestructura-resultado.log` y
  `apps/backend/acceptance/http-existente-resultado.log`.
- C6/C7 y carga C9 continúan sin ejecución integral: requieren esquema
  completo y fixtures de aplicación. No se consideran aprobados por estas
  pruebas de infraestructura ni por las pruebas del filtro.

## Correcciones — 30/10/2026

### C1: cancelación de proveedores

Se agregó `core/http/proveedor-rest.ts`: presupuesto de 5000 ms, un solo
intento y traducción de errores de transporte/cancelación a HTTP 503 con
mensaje legible. Mercado Pago consume también el cuerpo JSON dentro del
presupuesto; Storage usa el mismo límite al subir y borrar. No hay reintentos
automáticos de escrituras cuyo resultado pueda ser incierto.

Verificación: los cuatro clientes contra HTTP local demorado cancelan las
conexiones. La suite combinada de proveedores, formato de errores y regresión
HTTP pasó 31/31 pruebas (`acceptance/correcciones-http.log`).

### C8: Problem Details compatible con la web actual

El filtro global devuelve `application/problem+json`, `type`, `title`,
`status`, `detail` e `instance`; conserva códigos, Allow para 405 y correlación
para 500. Mantiene `message`, `statusCode` e `id` como extensiones para los
consumidores existentes. Los errores internos inesperados siguen ocultos.
No se modificaron componentes del frontend ni el manejo de cookies.

Verificación: formato para doce códigos y pruebas HTTP existentes incluidos
en las 31 pruebas aprobadas anteriores. Esto no acredita la selección de
todos los códigos en todos los endpoints de negocio.

### C3: reserva de correo antes del efecto externo

`EmailRepository.reservarEnvio` usa una transacción con advisory lock por
evento/destinatario. Confirma una marca `ENTREGA_INCIERTA` antes de contactar
SMTP. Un duplicado ya ENVIADO se omite; una entrega reservada o incierta falla
para que el evento termine en DLQ después de sus reintentos. Solo un rechazo
SMTP explícito (responseCode >= 400) habilita otro intento automático.
Un error posterior al envío no se cambia a FALLIDO ni vuelve a enviarse.
Los demás destinatarios continúan aunque uno tenga resultado incierto.

SMTP no permite prometer entrega exactamente una vez: esta solución evita
reenvíos automáticos inseguros y requiere conciliación de los casos inciertos.
Antes de reprocesar su DLQ, verificar el evento/destinatario en el proveedor:
si consta entregado, marcar ENVIADO y limpiar ultimo_error; si se comprobó
que no se aceptó, marcar FALLIDO y limpiar ultimo_error. Sin evidencia, no
liberar la reserva. Un Message-ID por sí solo no prueba que SMTP deduplique.

Verificación de componente: 9/9 pruebas de email aprobadas, incluyendo
concurrencia y fallo al registrar confirmación (`acceptance/correcciones-email.log`).
La prueba de fallo ahora exige mantener el correo en revisión y no reenviarlo;
no simula una entrega exitosa. Se agregó además prueba PostgreSQL de diez
reservas simultáneas y persistencia de la marca al reconstruir la conexión.

### C2: publicaciones pendientes durables

La migración `1793361600000-Outbox.ts` agrega `evento_outbox`. El repository
guarda el identificador y contenido antes de publicar; un despachador recupera
pendientes cada segundo, usa locks SKIP LOCKED y solo registra publicado_at
después de la confirmación del broker. Reutiliza evento_id si debe repetir.
Los productores esperan el almacenamiento en base, sin esperar al broker.
Una falla de persistencia se propaga en lugar de ocultarse como éxito.

El broker sigue entregando al menos una vez: los consumidores deben deduplicar.
El outbox no convierte por sí solo las escrituras anteriores del negocio en
una sola transacción con el evento. Esa ventana sigue pendiente en los
productores actuales: C2/C5 integrales no se declaran cerrados hasta mover
el registro del evento a la transacción del cambio de negocio.

### Activación y validaciones — base reactivada el 30/10/2026

Después de reactivar Supabase se verificó la conexión y se constató que las
nueve migraciones anteriores ya estaban aplicadas. Se ejecutó únicamente la
migración pendiente `Outbox1793361600000`, confirmada en transacción.
Luego se regeneraron las entities consultando la base y se aprobó `db:verify`:
32 entidades coinciden con el esquema. No se editaron entities a mano ni
se alteraron datos de negocio. El generador ahora mapea `bytea` a `Buffer`
para representar correctamente el contenido binario del outbox.

Comandos equivalentes ejecutados con Node y las dependencias locales:

```powershell
pnpm back migration:run
pnpm back db:generate-entities
pnpm back db:verify
```

No se reconstruyeron los contenedores de la aplicación del usuario; para
activar el código actualizado corresponde `docker compose up --build -d`.
La preparación de una base local con el esquema completo y datos descartables
sigue pendiente; no ejecutar carga ni pruebas de escritura sobre Supabase
compartido. La conexión reactivada permite avanzar con esa preparación.

La corrida completa de infraestructura posterior a los arreglos pasó 10/10
pruebas en aproximadamente 132 s (`acceptance/correcciones-infraestructura.log`):
incluye reserva de email con PostgreSQL real y recuperación de outbox después
de matar el publicador con el broker apagado. La prueba verifica el pendiente
persistido antes del reinicio y publicado_at después de la confirmación.
Se corrigió además el arranque del entorno descartable (permisos de cookie
Erlang y espera de disponibilidad AMQP); estos cambios son exclusivos del
compose de aceptación. La limpieza elimina solo ese proyecto de prueba.
Después del ajuste de cierre del despachador se repitió C2 por separado:
1/1 aprobada (`acceptance/correcciones-outbox.log`). TypeScript también pasa.

La regresión general del backend pasó 501/501 pruebas antes del último ajuste
de aislamiento por destinatario; luego se repitieron las 9 pruebas de email.
Evidencia: `acceptance/regresion-correcciones.log` (ignorada por git).
C6 (`Idempotency-Key`), C7 (ETag) y C9 (carga) siguen pendientes, igual que
la prueba de compensaciones de efectos externos. No son criterios aprobados.

## Implementación de cierre — 02/11/2026

Esta sección reemplaza el estado de los párrafos históricos anteriores.
Los procedimientos operativos están en [`operacion-resiliencia.md`](operacion-resiliencia.md).
SOAP/ARCA continúa excluido.

### Contratos REST y web

`POST /reclamos` acepta una `Idempotency-Key` ASCII de 1–128 caracteres sin
espacios. Su ámbito es usuario, método y ruta. La huella usa JSON canónico;
permisos y datos se validan antes de consultar una respuesta anterior. Dentro
de la misma transacción se bloquea esa clave, crea negocio, adjuntos y timeline,
registra outbox y conserva la respuesta 201. Una carga distinta responde 409;
contención superior al presupuesto de lock responde 503 con Retry-After.
La web conserva la clave del intento y el borrador después de perder respuesta;
no elimina adjuntos que puedan pertenecer a una operación ya confirmada.

`GET /consorcios/:id` expone ETag fuerte por representación y versión de fila.
`PATCH` requiere un único If-Match fuerte: ausente 428, inválido 400, viejo 412.
La comparación y escritura se realizan con bloqueo de fila en transacción;
un trigger incrementa versión incluso en un ciclo A–B–A. CORS expone ETag.
La web conserva el borrador ante 412 y exige recarga explícita para descartarlo.

La matriz HTTP observa 400/401/403/404/409/412/428/429 y errores del proveedor
en endpoints reales. No existe una regla de negocio actual que emita 422:
los DTO inválidos usan 400 y los conflictos 409. Por eso 422 no aplica como
escenario de negocio; el filtro sí puede representarlo en Problem Details.
Un 422 del proveedor de pagos se traduce a 502, sin exponer su cuerpo crudo.

La migración `ContratosRest1793620800000` está aplicada en Supabase con
autorización del usuario. Las 33 entities se regeneraron desde la base y
`db:verify` pasó; el generador reconoce una FK que también es parte de una PK.
No se editaron entities a mano.

### Atomicidad y efectos externos

Reclamos, novedades, asambleas, votaciones, emisión de expensas, reservas y
pagos guardan sus eventos con el mismo EntityManager que escribe el negocio.
No esperan SMTP ni RabbitMQ dentro de esas transacciones. La actualización
de pago, recibo, boleta y eventos por webhook también se confirma en conjunto.
El recordatorio manual de expensas y el aviso de intento de cobro extra son
publicaciones durables independientes, sin una mutación de negocio que unir.

Un resultado incierto de preferencia Mercado Pago conserva el pago pendiente
y bloquea otro checkout hasta conciliar. Storage dispone de compensación por
URL, con modo seco, rechazo de referencias y mantenimiento explícito.
La decisión del usuario es conservar SMTP y aceptar conciliación manual de
entregas inciertas; ese límite no se presenta como entrega exactamente una vez.

### Pruebas y evidencia

El runner `pnpm back test:aceptacion:integral --web --carga` usa el esquema
completo sin datos, credenciales efímeras, login real, backend Docker Node 22,
PostgreSQL 17, RabbitMQ y proveedores HTTP/SMTP locales. No lee credenciales
de producción ni escribe sobre Supabase. Genera 50 vecinos, 500 unidades,
3000 boletas y 500 reclamos. Mata y reconstruye el backend conservando la base.

Se agregaron suites HTTP, rollback antes/después de insertar outbox, webhook
concurrente, consumidores con reconexión, aceptación SMTP seguida de fallo de
registro, recuperación tras caída del broker, compensación de Storage y
Playwright con cookie httpOnly. La prueba DLQ usa el mismo cliente y service
que el comando operativo de inspección/reproceso.

Los reportes efímeros quedan en `apps/backend/acceptance/resultados/` (ignorado):
`integral.json` registra resultado, entorno, esquema, dataset y SHA con marca
de cambios sin commit; `carga-resumen.json` conserva percentiles por endpoint;
`web/reporte.json` y PNG conservan resultados visuales. No versionar sesiones.

La regresión del backend pasó **501/501** después de los cambios transaccionales
(`regresion-transaccional.log`). Tipos backend/frontend y ESLint frontend
aprobados, al igual que la compilación completa y las 22 pruebas de componentes
de proveedores/errores/email (`componentes-final.log`). La regeneración posterior
al contador y `db:verify` volvieron a pasar: 33 entidades y 31 enums.

La corrida Docker del 02/11 aprobó HTTP **7/7** antes y después del reinicio,
negocio **2/2**, consumidores **2/2 en cada proceso**, recuperación automática
de una novedad con RabbitMQ apagado y duplicados sin efectos adicionales, y
Storage **1/1 en cada fase** (backend activo/mantenimiento). El navegador pasó
C7 y las dos vistas responsive, pero C6 se detuvo por un selector de test que
buscaba un botón en lugar del rol `radio` del control. Se corrigió el selector
y se repite la corrida completa (`integral-final.log`); esa primera ejecución
no llegó a k6. Las capturas de 375 y 1440 px se inspeccionaron visualmente.

Las dos mediciones iniciales con backend ejecutado en Windows y PostgreSQL en
Docker fallaron el umbral de latencia de C9. La segunda eliminó la contención
de numeración usando una secuencia, pero aún no acreditó p95 < 500 ms.
No se relajaron umbrales. La corrida siguiente usa el backend compilado en
Docker junto a PostgreSQL; sus resultados deben evaluarse antes del cierre.

`NumeracionReclamos1793620800001` se aplicó a Supabase el 02/11/2026 tras la
autorización explícita posterior a explicar el contador y sus posibles saltos.
La migración confirmó CREATE SEQUENCE, inicialización desde códigos existentes
y COMMIT (`migracion-numeracion.log`), sin modificar reclamos. Se regenera y
verifica el esquema después de aplicarla.

La matriz de CI ahora incluye nueve jobs, con API integral, web y carga, y
conserva el disparador exclusivo de tags `v*`. No se creó ni publicó un tag.
La evidencia de GitHub Actions queda pendiente de la entrega del código.

### Verificación posterior y rendimiento

La segunda corrida de navegador aprobó **4/4**: conflicto entre pestañas,
respuesta de reclamo perdida después de commit y vistas a 375/1440 px.
La regresión posterior a los ajustes de durabilidad aprobó **503/503**
(`regresion-final.log`). Compilación completa, tipos y ESLint aprobados.

DLQ e inspección/reproceso mediante el cliente operativo aprobaron sus dos
escenarios con los tres TTL reales de 30 s. La corrida mínima pasó 9/10;
C2 se interrumpió al agotar el arranque de 15 s del worker mientras corrían
compilaciones. Se amplió esa espera de infraestructura a 60 s y se repitió
solo C2: **1/1 aprobado** en aproximadamente 49 s (`infraestructura-c2-final.log`).
Incluye dos despachadores concurrentes, 40 eventos repartidos sin duplicación
mediante SKIP LOCKED, persistencia sin URL de broker y recuperación tras matar
el worker con RabbitMQ apagado. No se modificó el presupuesto REST de 5 s.

Se corrigieron además dos publicaciones independientes: la ausencia de URL
del broker conserva el aviso en outbox; un fallo de persistencia del aviso
de cobro extra no confirma el webhook como exitoso. Las 34 pruebas de estos
componentes aprobaron (`avisos-durables-final.log`); quedan incluidas en las 503.

La medición con backend Docker y k6 pasando por `host.docker.internal` dio:

| Endpoint | Muestras | p95 | Errores HTTP | Resultado |
|---|---:|---:|---:|---|
| GET /boletas | 4457 | 1324,47 ms | 0 % | Falló latencia |
| GET /boletas/:id | 4457 | 1052,42 ms | 0 % | Falló latencia |
| POST /reclamos | 4457 | 1501,21 ms | 0 % | Falló latencia |

Docker tenía 8 CPUs y 8248131584 bytes de memoria asignada, con otros
contenedores del usuario activos que no se detuvieron. Se tomó un perfil de
CPU de 20 s sobre ese backend descartable para diagnóstico: construcción de
consultas TypeORM y procesamiento de resultados aparecieron entre los costos.
Esta corrida fallida no se usa como acreditación de C9.

Se eliminan consultas DISTINCT de IDs redundantes al leer un recurso por PK;
la paginación de boletas usa LIMIT/OFFSET porque sus joins son muchos-a-uno,
sin multiplicar filas. El detalle sigue trayendo todas sus líneas. Las altas
usan INSERT para nuevas entidades sin cascadas; autenticación lee solo los
campos necesarios de la sesión, manteniendo la consulta de permisos actuales.
Se verifica paginación sin IDs repetidos e importes numéricos del detalle.

La siguiente medición usa k6 en la misma red Docker que el backend (sin viaje
de ida y vuelta por el host). Mantiene 50 VUs, cinco minutos y los umbrales
originales. El fixture ahora incluye 9000 líneas de detalle: tres por cada
una de las 3000 boletas, sin reducir el dataset ni desactivar consumidores.

### Iteración de carga — 03/11/2026

Con la red Docker interna, la primera optimización completó 8094 recorridos:
p95 listado 656,15 ms, detalle 498,45 ms y alta 771,62 ms, con 0 % de errores
HTTP. Detalle pasó; listado y creación todavía fallaron. La siguiente medición
completó 8200: listado 639,31 ms, detalle 467,91 ms y alta 678,88 ms; también
sin errores HTTP. Se conservan ambos resúmenes en `resultados/carga-04-red-interna.json`
y `resultados/carga-05-proyeccion.json`. Los resultados siguen fallidos para C9.

La numeración ahora se calcula en el INSERT, conservando todos los dígitos
después de 9999. El listado lee una proyección escalar con su total exacto
mediante `count(*) OVER ()`; evita construir entidades completas y una segunda
consulta de conteo para páginas con resultados. Una página fuera de rango
conserva el total mediante una consulta de respaldo. Las pruebas HTTP verifican
páginas sin duplicados, página vacía, importes, coeficientes y fechas.

El plan equivalente del listado, medido con EXPLAIN ANALYZE sobre los fixtures,
ejecutó en 1,590 ms (`resultados/plan-boletas-final.txt`); no es una medición de
latencia HTTP. k6 prepara los tres endpoints con 100 lecturas y 50 altas fuera
de la ventana medida. Durante los cinco minutos se conserva el mismo recorrido,
50 VUs y la pausa de un segundo, sin excluir respuestas lentas del escenario.

Para iterar únicamente sobre rendimiento después de verificar las demás suites:

```powershell
pnpm back test:aceptacion:carga
```

Este comando recrea el entorno local, verifica boletas/numeración y ejecuta
los cinco minutos completos. El reporte identifica ese alcance y no afirma
haber repetido reinicios o navegador. CI conserva el comando integral completo
con `--web --carga`. No requiere conectarse a Supabase.

## Cierre acordado — 03/11/2026

El usuario pidió omitir más corridas y utilizar una estimación. Se detuvo la
iteración adicional durante la construcción de la imagen, antes de sus nuevas
pruebas y de k6; se limpiaron únicamente sus contenedores y base descartables.
Se conserva la implementación funcional ya verificada y el listado con proyección
escalar/conteo por ventana. Los ajustes de sesión/bloqueo de esa última iteración
no se incorporan como correcciones verificadas.

La última medición completa (`resultados/carga-06-ventana.json`) ejecutó
**50 VUs durante cinco minutos**, con **9010 muestras por endpoint** y **0 %
de errores HTTP**:

| Endpoint | p95 medido | Referencia redondeada | Umbral < 500 ms |
|---|---:|---:|---|
| GET /boletas | 504,12 ms | ~500 ms | No aprobado |
| GET /boletas/:id | 395,25 ms | ~400 ms | Aprobado en esa corrida |
| POST /reclamos | 607,07 ms | ~600 ms | No aprobado |

**La referencia redondeada es orientativa, no una nueva medición ni una
predicción garantizada. C9 permanece pendiente/no aprobado.** No se reemplaza
el reporte fallido por números estimados para declarar cumplimiento.

La regresión puntual del listado aprobó sus dos escenarios: importes/fechas,
paginación y total de una página vacía, y numeración de reclamos superior a
9999. La última corrida integral anterior aprobó 9 pruebas HTTP antes y después
del reinicio, negocio 2/2, consumidores 2/2 por proceso, recuperación de broker,
Storage y navegador 4/4; su carga falló. Regresión general 503/503, tipos,
compilación y `db:verify` cuentan con las evidencias anteriores. Las nuevas
pruebas de revocación de sesión y espera del bloqueo quedan preparadas para
la próxima ejecución; no se reportan como ejecutadas en la iteración cancelada.

La documentación y el código quedan cerrados para revisión, con estas dos
verificaciones pendientes explícitas: aprobar C9 con una medición real y obtener
la evidencia de GitHub Actions sobre un tag que contenga los cambios. Se mantiene
CI solo por tags `v*`, SOAP excluido y conciliación manual de SMTP aceptada.

## Medición con pool configurable — 05/11/2026

El backend ahora toma el tamaño del pool de conexiones de `DB_POOL_MAX`
(PR #30). Sin la variable sigue en 10, el default del driver. El runner de
aceptación la pasa al contenedor del backend y usa 30 si no se define otra.

Se corrió `node acceptance/ejecutar-integral.cjs --solo-carga --carga` dos veces
seguidas sobre el commit `8438470`, sin cambios locales: primero con
`DB_POOL_MAX=10` y después con `DB_POOL_MAX=30`. Docker Desktop con 12 CPUs y
16 GB en el host, sin otros contenedores activos; PostgreSQL 17.11. Mismo
dataset, recorrido, calentamiento y umbrales que las corridas anteriores.

La regresión puntual previa aprobó 4/4 en las dos corridas. Incluye las dos
pruebas que habían quedado preparadas sin ejecutar: revocación de sesión con el
mismo JWT y espera acotada del bloqueo con Retry-After.

| Endpoint | Pool 10: p95 | Pool 30: p95 | Umbral < 500 ms |
|---|---:|---:|---|
| GET /boletas | 253,01 ms | 223,48 ms | Aprobado en las dos |
| GET /boletas/:id | 200,09 ms | 192,95 ms | Aprobado en las dos |
| POST /reclamos | 331,89 ms | 445,96 ms | Aprobado en las dos |

Con pool 10 hubo 11.724 muestras por endpoint y con pool 30, 10.869; las dos con
0 % de errores HTTP y 100 % de checks. k6 terminó con código 0, así que el job
integral no falla por la carga en este entorno.

Lectura de los resultados: la mejora respecto del 03/11 se explica sobre todo
por el entorno (12 CPUs libres contra 8 compartidas), no por el pool. Subir a
30 conexiones mejoró poco las lecturas y empeoró el alta de reclamos, que pasó
de 332 a 446 ms con la mediana duplicada: más escrituras simultáneas compiten
en la base. Con estos datos, 10 es la mejor configuración medida.

Pendiente: el runner de GitHub tiene 4 CPUs, menos que los dos entornos
medidos. C9 queda acreditado en local; falta la ejecución del CI sobre un tag
para confirmarlo allí.
