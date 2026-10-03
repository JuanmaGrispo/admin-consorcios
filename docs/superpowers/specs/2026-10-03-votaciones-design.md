# Módulo Votaciones — diseño

> Fecha: 2026-10-03. Referencias: [producto.md](../../producto.md) (flujo
> "Votación en asamblea"), [mensajeria.md](../../mensajeria.md) (eventos
> `votacion.*`), pantallas 08 y 15b de [diseno-front.html](../../diseno-front.html)
> y el [diseño de asambleas](2026-10-02-asambleas-design.md).

## Objetivo

Que el administrador publique propuestas para que los vecinos voten —desde
la app o, en una asamblea presencial, cargadas por el administrador— y que el
sistema cuente los votos y decida el resultado según el padrón, la forma de
conteo y la mayoría que se configuraron.

## Alcance

**Entra:** ABM de votaciones, opciones, publicación y cierre, voto del vecino,
voto presencial cargado por el admin, padrón, escrutinio, visibilidad del
parcial, adjunto desde `archivos`, bloqueo de asambleas con votaciones
abiertas y votaciones abiertas en el inicio del vecino.

**Queda afuera:** eventos `votacion.nueva` / `votacion.cerrada` por RabbitMQ.
El aviso de publicación sale por el `Notificador` de `core/`.

Sin cambios de esquema: `votacion`, `opcion_voto` y `voto` ya existen.

## Estructura

`src/modules/votaciones/`:

| Archivo | Responsabilidad |
|---|---|
| `escrutinio.ts` | Función pura: suma votos por opción y decide el resultado |
| `padron.ts` | Función pura: qué unidades votan, quién por cada una y cuánto pesa |
| `votaciones.repository.ts` | Acceso a datos |
| `votaciones.service.ts` | Reglas, permisos, ciclo de vida |
| `votaciones.controller.ts` | Rutas de ambos portales |
| `dto/` | Entrada y queries |

Importa `ConsorciosModule`, `ExpensasModule` (deuda vencida) y
`ArchivosModule` (adjunto). Lee `asamblea`, `punto_orden_dia` y `asistencia`
con su propio repository, sin importar `AsambleasModule`, para no crear un
ciclo: es asambleas el que pregunta por votaciones.

## Dos tipos de votación

- **Independiente** (`asamblea_id` null): se vota sólo desde la app, entre
  `apertura` y `cierre`.
- **De asamblea**: se crea sobre un punto `CON_VOTACION` del orden del día
  (`punto_orden_dia_id`, UNIQUE). `asamblea_id` y `consorcio_id` salen del
  punto. Se vota mientras la asamblea está `EN_CURSO`; con
  `permite_voto_anticipado`, el vecino también puede votar desde la app con la
  asamblea `CONVOCADA`, y ese voto queda `anticipado = true`. Si no se indica
  `apertura`/`cierre`, se toman la hora de la asamblea y tres horas después.

## Opciones

Siempre existen dos opciones fijas (`es_fija`): **A favor** (orden 1) y **En
contra** (orden 2). El admin puede sumar otras (ej. "Abstención"), que van
después. `PUT /votaciones/:id/opciones` reemplaza sólo las no fijas. El
resultado se decide con A favor y En contra.

## Ciclo de vida

`BORRADOR → ABIERTA → CERRADA`

| Acción | Desde | Reglas |
|---|---|---|
| Crear | — | `BORRADOR`. Independiente: `consorcioId`, `apertura` y `cierre` obligatorios. De asamblea: el punto tiene que ser `CON_VOTACION`, sin votación, de una asamblea no cerrada y del consorcio indicado. `cierre > apertura`. `adjuntoUrl` tiene que venir de `archivos` (destino `votaciones`). |
| Editar / reemplazar opciones / eliminar | `BORRADOR` | Mismas validaciones. |
| Publicar | `BORRADOR` | Independiente: `cierre` futuro. De asamblea: asamblea `CONVOCADA` o `EN_CURSO`. Avisa a los vecinos del consorcio. |
| Cerrar | `ABIERTA` | Admin, en cualquier momento. Calcula y guarda `resultado`. |
| Cierre automático | `ABIERTA` | Una independiente con `cierre` pasado se cierra sola en la próxima consulta (mismo criterio que `cerrarVencidas` de reservas: sin cron). |

Acción desde un estado no permitido: **409**.

## Padrón (`padron.ts`)

Se calcula sobre las unidades **activas** del consorcio y sus vínculos vigentes:

- `SOLO_PROPIETARIOS`: entra la unidad con al menos un `PROPIETARIO`; votan
  sus propietarios. Un inquilino ve la votación pero no vota.
- `TODAS_LAS_UNIDADES`: entra toda unidad con algún vínculo; vota cualquiera
  de ellos.
- Peso: el coeficiente de la unidad (`POR_COEFICIENTE`) o 1 (`POR_UNIDAD`).
  Se copia en `voto.coeficiente_aplicado` al votar.
- Una unidad sin vínculos que califiquen no está en el padrón.

## Votar

Una unidad vota **una sola vez** y el voto **no se cambia** (UNIQUE
`votacion_id, unidad_id` en la base). `emitido_por` registra quién lo emitió.

- **Vecino** — `POST /votaciones/:id/votos` con `opcionId` y `unidadId`
  opcional (se infiere si vota por una sola unidad). Tiene que ser votante de
  esa unidad según el padrón (403 si no).
- **Admin, voto presencial** — `POST /votaciones/:id/votos/:unidadId` con
  `opcionId`. Sólo en votaciones de asamblea con la asamblea `EN_CURSO`. La
  unidad tiene que estar en el padrón.
- En ambos: la votación tiene que aceptar votos en ese momento (409 si no),
  la opción tiene que ser de esa votación (400), con `bloquea_con_deuda` una
  unidad con expensas vencidas no vota (403).
- Si la unidad ya votó: **409** que dice cuándo y si lo cargó la
  administración o salió de la app. Si dos votos de la misma unidad llegan a la
  vez, el UNIQUE deja pasar uno y el otro recibe el mismo 409.

## Escrutinio (`escrutinio.ts`)

- Por opción: suma de pesos y porcentaje sobre lo emitido.
- `SIMPLE_PRESENTES`: aprobada si A favor > En contra.
- `ABSOLUTA`: aprobada si A favor > 50% del peso total del padrón.
- `DOS_TERCIOS`: aprobada si A favor ≥ 2/3 del peso total del padrón.
- Empate exacto (A favor = En contra en simple, o exactamente 50% en
  absoluta): decide `desempate`.
- `SIN_QUORUM`: si no hubo ningún voto, o si es de asamblea y la asamblea no
  tenía quórum (`calcularQuorum` de asambleas) al cerrar la votación.
- Participación: peso emitido / peso del padrón.

Los pesos se comparan redondeados a 4 decimales para que la suma de
coeficientes no dé empates o desempates falsos por punto flotante.

## Visibilidad

- Admin: todo, con parcial y padrón (`GET /votaciones/:id/votos`: cada unidad
  del padrón, si votó, qué, cuándo y quién lo emitió).
- Vecino: votaciones `ABIERTA` y `CERRADA` de los consorcios donde tiene un
  vínculo vigente. Ve sus unidades habilitadas con su peso en % ("tu voto vale
  1,74%") y el voto de cada una. El parcial sólo si `mostrar_parcial` o si ya
  cerró. Lo que no puede ver: **404**.

## Integraciones

- **Asambleas**: no se puede cerrar una asamblea con votaciones `ABIERTA` (409
  "cerrá primero las votaciones").
- **Inicio**: `proximosEventos` suma las votaciones abiertas de sus consorcios
  (`tipo: 'VOTACION'`, `fecha` = cierre).
- **Expensas**: ya exige que un gasto con `votacionId` esté `APROBADA`; no cambia.

## API

| Método y ruta | Rol |
|---|---|
| `GET /votaciones` (filtros `consorcioId`, `asambleaId`, `estado`) | ambos |
| `GET /votaciones/:id` | ambos |
| `POST /votaciones` | admin |
| `PATCH /votaciones/:id` | admin |
| `DELETE /votaciones/:id` | admin |
| `PUT /votaciones/:id/opciones` | admin |
| `POST /votaciones/:id/publicar` | admin |
| `POST /votaciones/:id/cerrar` | admin |
| `GET /votaciones/:id/votos` | admin |
| `POST /votaciones/:id/votos/:unidadId` | admin |
| `POST /votaciones/:id/votos` | vecino |

## Tests

- `escrutinio.spec.ts`: cada mayoría, empates y desempate, sin votos,
  sin quórum, porcentajes, flotantes.
- `padron.spec.ts`: solo propietarios vs todas, inquilino excluido, unidad sin
  vínculos, peso por coeficiente y por unidad.
- `votaciones.service.spec.ts`: validaciones de alta, ciclo, ventana de voto,
  voto anticipado, voto duplicado (app y admin), deuda, visibilidad del parcial.
- Asambleas: cerrar con votaciones abiertas es 409. Inicio: votaciones en
  próximos eventos.
