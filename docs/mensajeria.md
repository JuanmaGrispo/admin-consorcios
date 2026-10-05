# Domus — Notificaciones multicanal (mensajería pub/sub)

> Documento de referencia para implementar en Claude Code.
> Equipo: Ignacio Alcaraz · Patricio Vecino · Juanmanuel Grispo · Felipe Vega Torre · Martin Capece
> Materia: Desarrollo de Aplicaciones II — Taller de escenario de mensajería

---

## 1. Contexto y proceso elegido

En vez de resolver un único evento aislado, se eligió el mecanismo que atraviesa **todo el módulo de comunicaciones de Domus**: cada vez que ocurre un evento de negocio relevante, uno o más canales (mail, muro de novedades del portal) tienen que enterarse y reaccionar — **sin que el módulo que originó el evento sepa nada de esos canales ni tenga que orquestarlos**.

### Eventos de dominio que disparan una notificación

| Evento (routing key) | Descripción | Módulo origen |
|---|---|---|
| `expensas.emitidas` | Se generaron las boletas de una liquidación | Liquidación y cobranzas |
| `asamblea.creada` | Se citó una nueva asamblea | Asambleas |
| `asamblea.recordatorio` | Faltan 48 h para una asamblea citada | Asambleas (tarea programada) |
| `votacion.nueva` | Se abrió una votación digital independiente | Votaciones |
| `votacion.cerrada` | Una votación llegó a su cierre y tiene resultado | Votaciones |
| `reclamo.cerrado` | Un reclamo pasó a estado resuelto | Reclamos |
| `novedad.publicada` | El administrador publicó un comunicado en el muro | Novedades |
| `aviso.directo` | Un aviso a una persona (reserva aprobada, pago recibido, respuesta a un reclamo, recordatorio de deuda) | `Notificador`, desde cualquier módulo |

Los dos últimos se sumaron al implementar. `novedad.publicada` hace que un
comunicado también llegue por mail; `aviso.directo` es lo que antes era
`Notificador.enviar()`, y así todos los mails salen fuera del request y con
reintentos. Ninguno de los dos llega al muro: el comunicado ya está ahí, y un
aviso personal no es una novedad del edificio.

---

## 2. Patrón elegido: publicación/suscripción (pub/sub)

**No punto a punto.** En casi todos los casos, un mismo evento interesa a **varios consumidores independientes al mismo tiempo**, no a uno solo que "gane" el mensaje.

Ejemplo: cuando se cierra una votación, Email y el muro de novedades necesitan enterarse los dos, cada uno con su propia lógica (redactar el mail, publicar la novedad).

**Por qué no punto a punto:** si fuera punto a punto, agregar un canal nuevo obligaría a tocar el código del módulo que generó el evento. Con pub/sub, el nuevo canal solo se suscribe al exchange — el productor no cambia nunca.

---

## 3. Diagrama del flujo

Se usa un **exchange de tipo `topic`** (no `fanout`), porque no todos los suscriptores quieren todos los eventos: el muro de novedades filtra por routing key para no generar ruido con información que no le corresponde.

```
                    ┌───────────────────────┐
LiquidacionService ─┤ publica:              │
                    │ expensas.emitidas     │──┐
                    └───────────────────────┘  │
                    ┌───────────────────────┐  │
AsambleaService    ─┤ publica:              │  │
                    │ asamblea.creada       │──┤
                    │ asamblea.recordatorio │  │
                    └───────────────────────┘  │      ┌──────────────────┐
                    ┌───────────────────────┐  ├─────▶│     Exchange     │
VotacionService    ─┤ publica:              │  │      │ "domus.eventos"  │
                    │ votacion.nueva        │──┤      │ (topic exchange) │
                    │ votacion.cerrada      │  │      └──────────────────┘
                    └───────────────────────┘  │              │    │
                    ┌───────────────────────┐  │              │    │
ReclamoService     ─┤ publica:              │──┘              ▼    ▼
                    │ reclamo.cerrado       │      ┌────────────────────────────┐
                    └───────────────────────┘      │ EmailNotificador           │
                                                   │ bind: # (todos los eventos)│
                                                   ├────────────────────────────┤
                                                   │ MuroNovedadesPublicador    │
                                                   │ bind: asamblea.creada,     │
                                                   │ votacion.nueva,            │
                                                   │ votacion.cerrada,          │
                                                   │ expensas.emitidas          │
                                                   └────────────────────────────┘
```

**Nota importante sobre el binding:** `reclamo.cerrado` **NO** llega al muro: es información personal del vecino que reclamó, no una novedad general del edificio. **Solo Email lo recibe**, como aviso directo al interesado.

`asamblea.recordatorio` tampoco llega al muro: la citación ya se publicó ahí con `asamblea.creada`, y repetirla 48 h antes sería ruido. El recordatorio sale solo por mail.

### Resumen de bindings por consumidor

| Consumidor | Routing keys que consume |
|---|---|
| `EmailNotificador` | `#` (todos los eventos, sin excepción, incluidos `novedad.publicada` y `aviso.directo`) |
| `MuroNovedadesPublicador` | `asamblea.creada`, `votacion.nueva`, `votacion.cerrada`, `expensas.emitidas` |

---

## 4. Broker, tipo de mensaje y estructura del body

- **Broker:** RabbitMQ, vía `amqplib` o `@nestjs/microservices`.
- **Tipo de mensaje:** el equivalente al `TextMessage` de JMS es un mensaje con **body en JSON**.
- **Exchange:** `domus.eventos`, tipo `topic`, `durable: true`.
- **Content type:** `application/json`.
- **Persistencia:** `persistent: true` (el mensaje sobrevive a un reinicio del broker).

### Sobre de mensaje común a todos los eventos

```json
{
  "evento_id": "uuid",
  "tipo_evento": "expensas.emitidas | asamblea.creada | asamblea.recordatorio | votacion.nueva | votacion.cerrada | reclamo.cerrado",
  "consorcio_id": "uuid | null (sólo aviso.directo)",
  "timestamp": "2026-09-25T12:00:00Z",
  "payload": { /* específico de cada evento */ }
}
```

### Contenido del `payload` por tipo de evento

| Routing key | Campos del payload |
|---|---|
| `expensas.emitidas` | `liquidacion_id`, `periodo`, `unidades_afectadas[]`, `fecha_vencimiento` |
| `asamblea.creada` | `asamblea_id`, `titulo`, `fecha`, `hora`, `lugar` |
| `asamblea.recordatorio` | `asamblea_id`, `titulo`, `fecha`, `hora`, `lugar` |
| `votacion.nueva` | `votacion_id`, `titulo`, `fecha_cierre`, `mayoria_necesaria` |
| `votacion.cerrada` | `votacion_id`, `titulo`, `resultado` (`aprobada` \| `rechazada` \| `sin_quorum`), `participacion_pct` |
| `reclamo.cerrado` | `reclamo_id`, `codigo`, `unidad_id`, `usuario_id`, `categoria`, `resolucion` (puede ser `null`) |
| `novedad.publicada` | `novedad_id`, `titulo` |
| `aviso.directo` | `destinatario_id`, `asunto`, `cuerpo`, `origen` |

Respecto del diseño original, `votacion.cerrada` suma `titulo` y el resultado
`sin_quorum` (una votación de asamblea sin quórum no decide nada), y
`reclamo.cerrado` suma `codigo`: los dos los necesita el mail. En asambleas,
`fecha` va como `AAAA-MM-DD` y `hora` como `HH:mm`, en hora de Buenos Aires.

---

## 5. Implementación de referencia (RabbitMQ + NestJS)

### 5.1 Productor — publica al exchange con la routing key del evento

```javascript
await channel.assertExchange('domus.eventos', 'topic', { durable: true });

channel.publish(
  'domus.eventos',
  'votacion.cerrada',
  Buffer.from(JSON.stringify({
    evento_id: uuid(),
    tipo_evento: 'votacion.cerrada',
    consorcio_id,
    timestamp: new Date().toISOString(),
    payload: { votacion_id, resultado, participacion_pct },
  })),
  { contentType: 'application/json', persistent: true },
);
```

Este mismo patrón se repite para cada módulo emisor, cambiando solo la routing key y el `payload`:

```javascript
// LiquidacionService
channel.publish('domus.eventos', 'expensas.emitidas', Buffer.from(JSON.stringify({
  evento_id: uuid(),
  tipo_evento: 'expensas.emitidas',
  consorcio_id,
  timestamp: new Date().toISOString(),
  payload: { liquidacion_id, periodo, unidades_afectadas, fecha_vencimiento },
})), { contentType: 'application/json', persistent: true });

// AsambleaService
channel.publish('domus.eventos', 'asamblea.creada', Buffer.from(JSON.stringify({
  evento_id: uuid(),
  tipo_evento: 'asamblea.creada',
  consorcio_id,
  timestamp: new Date().toISOString(),
  payload: { asamblea_id, titulo, fecha, hora, lugar },
})), { contentType: 'application/json', persistent: true });

// AsambleaService (tarea programada, 48 h antes de cada asamblea)
channel.publish('domus.eventos', 'asamblea.recordatorio', Buffer.from(JSON.stringify({
  evento_id: uuid(),
  tipo_evento: 'asamblea.recordatorio',
  consorcio_id,
  timestamp: new Date().toISOString(),
  payload: { asamblea_id, titulo, fecha, hora, lugar },
})), { contentType: 'application/json', persistent: true });

// VotacionService
channel.publish('domus.eventos', 'votacion.nueva', Buffer.from(JSON.stringify({
  evento_id: uuid(),
  tipo_evento: 'votacion.nueva',
  consorcio_id,
  timestamp: new Date().toISOString(),
  payload: { votacion_id, titulo, fecha_cierre, mayoria_necesaria },
})), { contentType: 'application/json', persistent: true });

// ReclamoService
channel.publish('domus.eventos', 'reclamo.cerrado', Buffer.from(JSON.stringify({
  evento_id: uuid(),
  tipo_evento: 'reclamo.cerrado',
  consorcio_id,
  timestamp: new Date().toISOString(),
  payload: { reclamo_id, unidad_id, usuario_id, categoria, resolucion },
})), { contentType: 'application/json', persistent: true });
```

### 5.2 Suscriptor — declara su propia cola y hace el binding selectivo

Ejemplo con `EmailNotificador`:

```javascript
const qEmail = await channel.assertQueue('q.email-notificador', { durable: true });
await channel.bindQueue(qEmail.queue, 'domus.eventos', '#');

channel.consume(qEmail.queue, (msg) => {
  const evento = JSON.parse(msg.content.toString());
  enviarEmail(evento); // lógica propia de este suscriptor
  channel.ack(msg);
});
```

El otro consumidor sigue exactamente el mismo patrón, cambiando solo el nombre de cola y las routing keys del binding:

```javascript
// MuroNovedadesPublicador
const qMuro = await channel.assertQueue('q.muro-novedades-publicador', { durable: true });
for (const key of ['asamblea.creada', 'votacion.nueva', 'votacion.cerrada', 'expensas.emitidas']) {
  await channel.bindQueue(qMuro.queue, 'domus.eventos', key);
}
channel.consume(qMuro.queue, (msg) => {
  const evento = JSON.parse(msg.content.toString());
  publicarNovedad(evento);
  channel.ack(msg);
});
```

---

## 6. Dónde está implementado

| Pieza | Archivo |
|---|---|
| Conexión, topología, publicador y sobre | `apps/backend/src/core/mensajeria/` |
| `Notificador` → `aviso.directo` | `apps/backend/src/core/notificaciones/notificador.ts` |
| `EmailNotificador` (NodeMailer) | `apps/backend/src/modules/email/` |
| `MuroNovedadesPublicador` | `apps/backend/src/modules/novedades/muro.consumer.ts` |
| Recordatorio 48 h antes (`@nestjs/schedule`) | `apps/backend/src/modules/asambleas/recordatorio-asambleas.ts` |

- **Broker:** CloudAMQP compartido por el grupo (`RABBITMQ_URL`), o uno local
  con el `docker-compose.yml` de la raíz.
- **Consumidores:** corren en el mismo proceso de Nest y arrancan con la app.
  El handler sólo delega en un service, como pide la regla de capas.
- **Reintentos:** cada cola tiene una `.reintento` (TTL 30 s, vuelve a la
  principal) y una `.dlq`. Hasta 3 reintentos, con el contador en el header
  `x-intentos`.
- **Idempotencia:** el mail registra cada envío en `envio_notificacion` y no
  repite uno ya ENVIADO. El muro guarda la novedad y la marca en
  `evento_procesado` en la misma transacción.
- **Recordatorio sin duplicados:** el mismo `UPDATE` que elige las asambleas
  marca `asamblea.recordatorio_enviado_at`.

---

## 7. Checklist para la implementación

- [x] Levantar RabbitMQ (CloudAMQP, o local con Docker).
- [x] Instalar `amqplib` (con `amqp-connection-manager` para reconectar).
- [x] Declarar el exchange `domus.eventos` (`topic`, `durable: true`) en un módulo compartido de infraestructura (`core/mensajeria`).
- [x] Implementar el publish en cada servicio emisor, validando el sobre común antes de serializar.
- [x] Programar la tarea que publica `asamblea.recordatorio` 48 h antes (`@nestjs/schedule`), sin publicarlo dos veces para la misma asamblea.
- [x] Implementar cada consumidor con su cola durable y sus bindings específicos, según la tabla de la sección 3.
- [x] Usar `ack` manual (no autoAck).
- [x] Definir una dead-letter queue (DLQ) para mensajes que fallan repetidamente.
- [x] Testear el filtro de `reclamo.cerrado` y `asamblea.recordatorio`: el muro no los recibe (`muro.ts` y sus tests).

---

## 8. Puntos clave para no perder de vista

1. **Desacoplamiento total:** ningún productor conoce a los consumidores; agregar un canal nuevo (ej. push notifications) es sumar una cola + binding, sin tocar el código existente.
2. **Topic, no fanout:** el filtrado por routing key es lo que evita que el muro reciba ruido irrelevante (y, en el caso de `reclamo.cerrado`, información privada).
3. **Mismo "sobre", payload variable:** todos los eventos comparten `evento_id`, `tipo_evento`, `consorcio_id`, `timestamp`; solo cambia la forma de `payload`.
4. **Persistencia end-to-end:** exchange durable + cola durable + mensaje `persistent: true` = no se pierden eventos si el broker reinicia.
