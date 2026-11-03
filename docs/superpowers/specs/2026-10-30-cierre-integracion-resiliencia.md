# Cierre de integración y resiliencia — especificación

Fecha: 30/10/2026. Cierre para revisión al 03/11/2026: implementación preparada,
C9 no aprobado y nuevas corridas omitidas por decisión del usuario. El registro
de aceptación distingue mediciones, referencias orientativas y evidencia de CI pendiente.

Referencias: [registro de aceptación](../../aceptacion-integracion-resiliencia.md),
[CI de versión](../../ci.md), [mensajería](../../mensajeria.md) y
[producto](../../producto.md).

## Objetivo y alcance

Cerrar los criterios pendientes del eje de integración y resiliencia de
Domus, conservando las correcciones ya verificadas de timeouts, Problem
Details, rollback, deduplicación y DLQ. SOAP y ARCA quedan explícitamente
fuera de alcance por decisión del usuario.

La entrega comprende código, migraciones, adaptación de los clientes web,
fixtures locales, pruebas reproducibles y reportes. No alcanza con una suite
verde de componentes: los escenarios se ejecutan también contra el backend
real y se comprueban sus efectos persistidos.

| Criterio | Trabajo restante | Condición de cierre |
|---|---|---|
| C1 | Completar escenarios HTTP y fallos durante lectura del cuerpo externo | Timeout efectivo y respuesta comunicada, sin repetir escrituras inciertas |
| C2 | Cambio de negocio y registro outbox en la misma transacción | Recuperación automática tras caída del broker y reinicio del backend, sin pérdida de eventos confirmados |
| C3 | Probar muro y email con persistencia y proveedor de prueba | Un único efecto ante duplicados concurrentes y reinicios; ambigüedad externa resuelta o límite aceptado explícitamente |
| C4 | Automatizar inspección y reproceso operativo | Inválidos/fallos agotados en DLQ, registro suficiente y reproceso seguro |
| C5 | Cubrir productores y compensaciones | Rollback completo, sin evento huérfano; efectos externos conciliados |
| C6 | Implementar Idempotency-Key en POST /reclamos | Un recurso y la misma respuesta en repeticiones, concurrencia y reinicio |
| C7 | Implementar ETag/If-Match en consorcios y adaptar la web | Escritura con versión vieja devuelve 412 y no sobrescribe |
| C8 | Verificar errores de endpoints reales | Formato y códigos correctos, permisos y errores externos incluidos |
| C9 | Preparar y ejecutar carga | 50 usuarios, 5 min, p95 < 500 ms y errores < 1 % en cada endpoint |

## Reglas de implementación

Mantener controller → service → repository/client. Las transacciones y el
SQL viven en repositories. La coordinación de negocio permanece en services.
No modificar entities generadas: cambios de esquema mediante migraciones,
regeneración desde Supabase y `db:verify` antes de commitear.

La sesión web continúa en cookie httpOnly. No exponer tokens, crear rutas
públicas de prueba ni introducir lógica especial de aceptación en producción.
Las nuevas pruebas usan bases descartables; Supabase compartido solo se usa
para las migraciones acordadas y la introspección del esquema.

## 1. Transacciones de negocio y outbox

Actualmente `OutboxRepository.guardar` persiste con su propia conexión,
después del cambio de negocio. Se debe poder registrar usando el mismo
`EntityManager` que guarda la operación, con un contrato explícito entre
repositories. No usar un manager global mutable, monkey patches ni una
transacción que quede abierta durante una llamada externa.

El service prepara el evento, validado con el contrato de `eventos.ts`, y lo
entrega al repository junto con el cambio. El repository escribe ambas cosas
en una única transacción. El publicador deja de volver a registrar ese evento
después del commit; el despachador lee los pendientes ya confirmados.
El evento mantiene su UUID a través de todos los intentos de publicación.

Revisar todos los productores, sin limitarse al caso de demostración:

- `expensas.emitidas`: emisión y boletas correspondientes.
- `asamblea.creada` y `asamblea.recordatorio`: convocatoria y marca del recordatorio.
- `votacion.nueva` y `votacion.cerrada`: publicación/cierre y resultado.
- `reclamo.cerrado`: cambio de estado y timeline.
- `novedad.publicada`: novedad y adjuntos.
- `aviso.directo`: auditar cada llamada a `Notificador` en pagos, reservas y
  demás módulos, y unir el registro al cambio que origina el aviso.

Si una operación genera varios eventos, se guardan todos o ninguno. Un evento
inválido aborta la operación: no se registra el negocio como exitoso mientras
se descarta silenciosamente su evento. El recordatorio no queda marcado como
enviado sin un pendiente durable correspondiente.

El despachador conserva confirmaciones de RabbitMQ, `SKIP LOCKED` y entrega
al menos una vez. Un fallo después de confirmar en RabbitMQ y antes de
actualizar publicado_at puede duplicar la entrega; los consumidores deduplican
con el evento_id original. No se promete entrega exactamente una vez por el
mero uso de outbox.

Pruebas: fallo antes de guardar evento, fallo después del INSERT outbox y
antes de commit, caída inmediatamente después del commit, broker apagado,
reinicio abrupto del backend y dos despachadores concurrentes. Comprobar filas
de negocio, outbox y efectos de los consumidores. Ejecutar una operación
HTTP real durante la caída, no solo invocar RabbitClient desde un worker.

## 2. Idempotencia de POST /reclamos

Alcance inicial contractual: `POST /reclamos`. Inventariar los demás POST
críticos y documentar cuáles requieren el mismo patrón; no afirmar que todos
son idempotentes por cubrir este endpoint.

El header `Idempotency-Key` será opcional para compatibilidad. Si se envía,
validar longitud de 1–128 caracteres ASCII imprimibles sin espacios ni
controles; una clave inválida responde 400 Problem Details. El frontend genera
un UUID al iniciar una intención de alta y conserva esa clave y el mismo
contenido en reintentos de esa intención. Una alta nueva usa otra clave.
No generar una clave nueva automáticamente por cada llamada a `api()`.

Agregar una tabla mediante migración con usuario, método, ruta canónica,
clave, huella SHA-256 del DTO validado serializado canónicamente, estado HTTP,
cuerpo JSON de respuesta, cabeceras estables necesarias y fecha de creación.
Restricción única por usuario + método + ruta + clave. No guardar cookies,
JWT ni cabeceras de autenticación. El almacenamiento contiene datos de negocio:
acceso solo desde backend, sin volcados en logs ni reportes.

La escritura del reclamo, sus adjuntos/timeline, cualquier evento y la respuesta
de idempotencia se confirman en la misma transacción. El repository obtiene
un bloqueo por ámbito/clave antes de consultar o crear. Las solicitudes
concurrentes esperan la resolución y leen la respuesta persistida; un índice
único sigue siendo la garantía final. No retener una conexión bloqueada sin
límite: definir timeout de espera y respuesta temporal documentada con
Retry-After, sin crear un segundo recurso.

| Solicitud | Resultado |
|---|---|
| Clave nueva y DTO válido | Una creación y respuesta 201 persistida |
| Misma clave y huella | Mismo ID, estado y JSON; no recalcular timestamps ni efectos |
| Misma clave con otro contenido | 409 Problem Details; sin escrituras |
| Misma clave de otro usuario | Ámbito independiente, sujeto a permisos actuales |
| Fallo antes de commit | Rollback de recurso, evento y registro; se puede reintentar |
| Reinicio después de commit | Se devuelve la respuesta persistida |

Los guards de autenticación y alcance se ejecutan antes de reproducir una
respuesta. No devolver una respuesta almacenada a alguien que perdió acceso.
El contrato inicial no expira claves automáticamente: cualquier política
futura de retención debe definir su ventana y evitar recreaciones silenciosas.

Pruebas HTTP + PostgreSQL: diez solicitudes simultáneas, repetición secuencial,
repetición tras reiniciar proceso, carga diferente, dos usuarios, clave
inválida y fallo inducido previo al commit. Contar exactamente un reclamo,
una timeline de creación y los eventos esperados.

## 3. Concurrencia con ETag

Alcance contractual inicial: `GET /consorcios/:id` y `PATCH /consorcios/:id`.
Agregar una versión monotónica persistida mediante migración. Todos los
caminos que modifiquen ese consorcio deben incrementarla; no basarse solo
en un timestamp ni en el ETag débil automático de Express.

GET devuelve un ETag fuerte entre comillas. Debe variar cuando cambia la
representación: combinar identidad, versión y hash de la representación JSON
canónica devuelta, incluyendo datos relacionados si forman parte del cuerpo.
Evitar campos volátiles. El service construye el DTO y el controller expone
la cabecera; los detalles técnicos no se agregan al formulario como dominio.

PATCH requiere `If-Match`. Sin header: 428; header malformado o no soportado:
400; valor desactualizado: 412. El contrato web usa un ETag fuerte exacto;
rechazar ETags débiles, listas y `*` explícitamente con 400 en este alcance.
El repository bloquea/relee el recurso dentro de la transacción, compara la
precondición y guarda el cambio incrementando la versión de forma atómica.
Las rutas de recursos ajenos o inexistentes mantienen su comportamiento 404.
Devolver el recurso y su nuevo ETag tras actualizar.

El cliente web conserva ETag al leer y lo envía al guardar. Ante 412 conserva
el borrador e informa que el recurso cambió; ofrece recargar para revisar y
volver a editar. No reintenta sobrescribiendo automáticamente con la versión
nueva. Exponer `ETag` mediante CORS y permitir `If-Match`/`Idempotency-Key`.
Leer las reglas de frontend vigentes antes de implementar UI.

Pruebas: dos clientes con la misma versión; actualizaciones concurrentes con
exactamente un éxito y un 412; escritura vieja sin efectos; header ausente,
inválido y débil; recurso ajeno; edición desde la web; cambio de relaciones
visibles; secuencia A → B → A sin reutilizar la versión inicial.

## 4. Duplicados, SMTP, DLQ y compensaciones

Muro y bandeja deben confirmar efecto + marca de evento en la misma
transacción. Probar duplicados concurrentes, reinicio y fallo antes de commit
para ambos consumidores. Verificar también la cardinalidad por destinatario.

La reserva de email actual evita reenvíos inciertos, pero no garantiza que
todos los correos lleguen. Agregar un receptor SMTP de prueba y fallos entre
aceptación SMTP y confirmación en base. Verificar que el evento llega a DLQ
sin un segundo envío y que otros destinatarios continúan procesándose.

No declarar C3 íntegramente aprobado como «exactamente una vez» mientras
existan entregas ambiguas sin resolver. Para una garantía automática de un
efecto único, evaluar un proveedor con idempotencia persistida por
evento/destinatario y una ventana suficiente para los reintentos y reprocesos.
Si se conserva SMTP, documentar y aceptar explícitamente la conciliación
manual como límite; una implementación sin duplicados y con posibles no
entregas no equivale a exactamente una entrega. No usar Message-ID como
garantía de deduplicación.

Agregar comandos de inspección y reproceso con cola e identificador de evento
explícitos. Inspección no retira mensajes. Reproceso confirma la republicación
antes de ACK a la copia DLQ, conserva evento_id y registra la intervención.
Una copia duplicada por caída entre publicación y ACK debe ser segura.
No liberar automáticamente una reserva SMTP incierta. Validar el sobre en
reproceso; los mensajes inválidos requieren corrección explícita y trazable.

Auditar pagos y archivos: enumerar el efecto externo, las escrituras locales,
la falla posible y su recuperación. Una transacción de PostgreSQL no revierte
un cobro ni un archivo subido. Ante timeout con resultado incierto, consultar
estado/conciliar antes de repetir una escritura. Para cobros ya efectuados,
persistir la conciliación y aplicar compensación/reintegro solo mediante un
flujo autorizado e idempotente. En Storage, definir limpieza reintentable de
archivos huérfanos por su ruta estable. Nunca «compensar» omitiendo un error.

Pruebas: webhook repetido sin doble recibo ni cambio duplicado de boleta;
falla local después de un resultado externo; resultado externo incierto;
recuperación después de reiniciar; reproceso repetido sin multiplicar efectos.

## 5. Entorno integral reproducible

Extender el entorno de aceptación con backend real, PostgreSQL con esquema
completo, RabbitMQ, receptor de correo y proveedores HTTP simulados.
El esquema se exporta sin datos desde la base fuente; la restauración local
debe incluir extensiones, enums, constraints, índices y funciones necesarios.
No asumir que las migraciones históricas crean por sí solas toda la base.

Proveer un mecanismo versionado para preparar el entorno desde cero sin
depender de una copia privada del esquema en la máquina del autor. Seleccionar
durante implementación entre snapshot SQL de esquema revisado y versionado,
o artefacto de esquema reproducible disponible a CI. Nunca usar credenciales
de Supabase compartido en los jobs de aceptación. Documentar origen y versión
del esquema y comprobar deriva respecto de entities/migraciones.

El seed local crea identidades ficticias para superadmin, administrador,
vecino con acceso y vecino ajeno; consorcio, categoría, unidad y boletas
representativas. Las contraseñas son efímeras y no aparecen en logs. Obtener
sesiones mediante login real; probar la web con cookie httpOnly. Las
pruebas de API también pueden usar bearer obtenido por login, sin persistirlo
en artefactos. Nada de tokens copiados manualmente para ejecutar CI.

El runner prepara, espera readiness real, ejecuta, captura resultados y
limpia solo su proyecto descartable. Debe funcionar en Windows para desarrollo
y Ubuntu/Node 22 para Actions. Los fallos de infraestructura se reportan
distintos de un incumplimiento del producto; ninguna suite requerida se
considera aprobada si no llegó a ejecutarse por falta de variables o fixtures.

## 6. Errores y carga

Completar pruebas de C8 en endpoints reales: 400 por DTO inválido, 401 por
sesión ausente, 403 por rol, 404 por alcance/existencia, 409 por conflicto,
412 por precondición, 428 por precondición ausente, 429 por límite y 5xx
ante fallos controlados. Para 422, identificar una regla real que corresponda
a ese código o documentar su no aplicabilidad; no crear un endpoint artificial
ni cambiar validaciones a 422 solo para conseguir una prueba verde.

En todos los casos verificar status, media type, campos Problem Details,
ausencia de secretos/stack y mensaje usable por la web. C1 debe incluir
cabeceras lentas, cuerpo lento, corte de conexión y rechazo del proveedor,
con cancelación y ausencia de reintentos inseguros.

Para C9 conservar los tres endpoints definidos: GET /boletas,
GET /boletas/:id y POST /reclamos. Cada usuario realiza los tres durante
cinco minutos con 50 VUs constantes y pausas representativas. Cada creación
nueva tiene su propia Idempotency-Key; las pruebas de repetición son otras.
Definir al menos 50 identidades de carga con acceso a fixtures válidos para
evitar que una única cuenta o fila distorsione la concurrencia.

Preparar al menos 500 unidades, 3000 boletas y 500 reclamos, con paginación
realista, en el entorno de prueba. Registrar hardware/recursos asignados,
versiones, tamaño del dataset y límites de conexión. Excluir el calentamiento
y login de la ventana medida, sin excluir requests lentos ni errores reales.
No relajar umbrales para acomodar resultados.

Por endpoint, exigir muestras > 0, p95 estrictamente < 500 ms,
http_req_failed < 1 % y fallos de checks funcionales < 1 %. Verificar estado
y contenido mínimo (no solo ausencia de 5xx). Guardar resumen JSON k6,
conteos, percentiles y reporte interpretado. Si falla, medir queries/planes,
índices y contención, corregir y repetir; no declarar aprobación extrapolada
de pruebas unitarias o de proveedores simulados.

## 7. CI de versión y secuencia de entrega

Mantener exclusivamente el disparador actual por push de tags `v*`.
No agregar CI en PR, pushes de ramas ni un disparador de Release distinto
sin un pedido del usuario. Al automatizar fixtures, incorporar API integral
y carga al workflow existente, con tiempo suficiente y artefactos por job.
Los jobs actuales de componentes e infraestructura mínima permanecen.

Secuencia propuesta, mediante branches/PR a develop y promoción a main:

1. Esquema y runner local integral con seed reproducible.
2. Atomicidad de todos los productores y pruebas de fallos C2/C5.
3. Idempotencia REST, cliente web y pruebas C6.
4. ETag, cliente web y pruebas C7.
5. Muro/email, conciliación, compensaciones y comandos DLQ C3/C4.
6. Matriz HTTP C1/C8, carga C9 e incorporación a CI por tags.

Cada paso incluye sus pruebas; no postergar todas las verificaciones al
último paso. No publicar un tag como evidencia de código que no contiene
las correcciones ni mover un tag de una entrega anterior.

## Definición de terminado

- [x] Todos los productores guardan negocio y eventos atómicamente.
- [x] C2/C5 pasan con HTTP real, caída, reinicio y lectura de base.
- [x] C6 pasa secuencialmente, en paralelo y tras reinicio.
- [x] C7 pasa en API y web sin sobrescritura silenciosa.
- [x] C3 demuestra efectos únicos y explicita/resuelve los límites de SMTP.
- [x] C4 dispone de inspección/reproceso operativo probado y trazable.
- [x] Compensaciones de pagos/archivos documentadas y verificadas.
- [x] C1/C8 se verifican en endpoints reales, sin rutas públicas de prueba.
- [ ] C9 cumple los umbrales por cada uno de los tres endpoints.
- [x] Regresión, tipos, build y db:verify aprobados; entities regeneradas.
- [ ] Un tag que contiene los cambios ejecuta las suites en GitHub Actions.
- [ ] Se conserva enlace al tag/SHA, ejecución CI, comandos, entorno, dataset
  y reportes sin credenciales ni datos personales reales.
- [x] El registro de aceptación se actualiza con resultados posteriores,
  separando aprobado, fallido, pendiente y límite aceptado. SOAP no se agrega.
