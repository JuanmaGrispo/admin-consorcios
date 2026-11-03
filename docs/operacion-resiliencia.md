# Operación y conciliación de resiliencia

SOAP/ARCA queda fuera del alcance. Estos procedimientos complementan las
pruebas automatizadas; los operadores conservan evidencia del evento, recurso,
fecha, causa y resultado sin copiar credenciales ni datos personales al repo.

## SMTP: límite aceptado

El usuario eligió conservar SMTP y conciliación manual de entregas inciertas
el 02/11/2026. No se promete entrega exactamente una vez cuando SMTP acepta
el mensaje y el proceso cae antes de confirmar `ENVIADO` en PostgreSQL.

Antes de enviar, se confirma una reserva durable por evento y destinatario.
Un duplicado de un envío confirmado se omite; una reserva incierta no se
reenvía automáticamente y el evento termina en DLQ tras sus reintentos.
El resto de los destinatarios puede continuar y queda deduplicado.

1. Identificar evento y destinatario en `envio_notificacion`; detener el
   reproceso de ese evento mientras se investiga.
2. Consultar la aceptación en los registros del servidor/proveedor SMTP.
   El `Message-ID` por sí solo no acredita aceptación ni deduplicación.
3. Si existe evidencia de aceptación, registrar `ENVIADO`, `enviado_at` y
   limpiar `ultimo_error` en la fila exacta, conservando la evidencia externa.
4. Solo si se comprobó que SMTP no aceptó el mensaje, registrar `FALLIDO`
   y limpiar `ultimo_error` para habilitar un nuevo intento. Sin evidencia,
   mantener la incertidumbre y resolver con el responsable operativo.
5. Reprocesar el evento de DLQ; los destinatarios ya confirmados se omiten.

Los cambios de conciliación son intervenciones operativas auditadas, no un
botón que suponga que un timeout equivale a una entrega fallida.

## Inspección y reproceso de DLQ

Con `RABBITMQ_URL` en el entorno, desde la raíz:

```powershell
pnpm back mensajeria:dlq inspeccionar q.email-notificador.dlq
pnpm back mensajeria:dlq reprocesar q.email-notificador.dlq <evento_id>
```

La inspección muestra metadatos de hasta 100 mensajes, sin ACK ni cuerpos.
La operación requiere una cola `.dlq` explícita y no cambia permisos del broker.
El reproceso selecciona un sobre válido por `evento_id`, conserva ese ID y
reinicia `x-intentos`. Confirma la republicación en la cola principal antes
de retirar la copia de DLQ. Si el proceso cae entre confirmación y ACK puede
haber duplicados: siguen siendo necesarias las marcas de los consumidores.
Los otros mensajes se devuelven; su orden puede cambiar. Si el evento está
fuera de la ventana de inspección, la operación falla sin eliminar mensajes.
Corregir primero la causa del fallo; no reprocesar automáticamente una DLQ.

## Mercado Pago: resultado incierto

Una preferencia aceptada por el proveedor puede perder su respuesta. El pago
local conserva `PENDIENTE` y `mp_status_detail=preferencia_incierta`; un nuevo
checkout sobre ese destino responde 409 hasta conciliar. No se repite el POST
automáticamente. Un rechazo explícito 4xx puede dejar el intento rechazado.

Revisar el pago local y buscar en el proveedor por `external_reference`
(ID del pago). Conservar la referencia y evidencia; si existe preferencia o
cobro, reconciliar contra ese mismo pago. Un webhook firmado y verificado
actualiza pago, recibo, boleta y eventos dentro de una sola transacción.
No crear un segundo pago para ocultar el primero. Si no es posible determinar
el resultado, mantener el bloqueo y escalar la conciliación.

Los reembolsos comprobados por webhook conservan el número de recibo y
recalculan el estado local sin emitir otro recibo ni duplicar notificaciones.
Un cobro extra sobre un pago ya aprobado genera aviso al administrador para
revisión; no se dispara un reembolso externo automático.

## Storage: compensar un archivo huérfano

Una subida puede confirmarse antes de que falle el formulario que la iba a
referenciar. Los errores registran la ruta de intento; no el cuerpo crudo del
proveedor. Un timeout de subida requiere comprobar si el objeto existe.

La compensación es explícita y por URL exacta. Primero ejecutar en seco:

```powershell
pnpm back archivos:compensar <url_del_objeto>
```

Verificar que corresponde a un formulario descartado. Detener todas las
instancias del backend y mantener detenidos otros escritores durante toda
la intervención; bloquear su reinicio mientras se elimina. Después:

```powershell
pnpm back archivos:compensar <url_del_objeto> --aplicar --mantenimiento
```

Se comprueba pertenencia al Storage configurado, ruta válida y ausencia de
referencias en reclamos, novedades, gastos, votaciones, asambleas y avatares.
Se rechaza la aplicación si hay conexiones del backend identificado; esto
no reemplaza la obligación operativa de detener otros escritores. Se vuelve
a comprobar referencias antes de DELETE. Un DELETE repetido/404 es éxito.
No es un recolector automático ni una garantía frente a escritores externos
que incumplan el mantenimiento. No borrar adjuntos de un reclamo cuyo POST
quedó incierto: puede estar confirmado aunque la web no haya visto respuesta.

## Despliegue del esquema

`ContratosRest1793620800000` fue aplicada a Supabase con autorización explícita
y se regeneraron las entities desde la base. `NumeracionReclamos1793620800001`
se aplicó también en Supabase el 02/11/2026, después de una segunda autorización
explícita del usuario. Agrega un contador PostgreSQL inicializado
por encima de los códigos existentes, sin modificar reclamos. Evita que dos
creaciones calculen el mismo código y la contención de un bloqueo global.
Puede haber saltos en la numeración si una transacción falla, como es habitual
con secuencias. Ambas migraciones necesarias preceden a la activación del
código actualizado; no se reconstruyeron los contenedores de la app del usuario.

## Alcance de Idempotency-Key

El contrato implementado cubre `POST /reclamos`, como fija la spec. No existe
una garantía global para todos los POST del sistema.

| Operación | Protección actual y trabajo futuro |
|---|---|
| Alta de reclamo | Clave por intención, respuesta persistida y transacción única con outbox. |
| Registrar pago manual | Transacción y recibo único por pago; una segunda solicitud puede crear otro pago. Requiere extender el contrato antes de habilitar reintentos automáticos. |
| Crear preferencia de pago | Reutiliza checkout abierto y bloquea resultados inciertos; no equivale a Idempotency-Key frente a dos solicitudes nuevas concurrentes. |
| Webhook de pago | Firma y consulta al proveedor; bloqueo/estado impiden repetir aprobación, recibo y efectos del mismo pago. Otro intento externo cobrado requiere conciliación. |
| Crear reserva | Transacción, reglas de disponibilidad/cupo; no deduplica toda repetición por intención. Requiere una clave si se agregan reintentos de altas. |
| Crear novedad, asamblea o votación | Outbox atómico; las altas no implementan el contrato de clave. Evitar reintentos automáticos de escrituras inciertas hasta extenderlo. |
| Subir archivo | Ruta UUID por subida y compensación explícita de huérfanos; no reintenta automáticamente una subida incierta. |
