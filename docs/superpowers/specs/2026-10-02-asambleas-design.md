# Módulo Asambleas — diseño

> Fecha: 2026-10-02. Referencias: [producto.md](../../producto.md) (flujo
> "Votación en asamblea"), [mensajeria.md](../../mensajeria.md) (eventos
> `asamblea.*`) y las pantallas 06, 07, 09 y 15 de
> [diseno-front.html](../../diseno-front.html).

## Objetivo

Que el administrador cree, convoque, lleve adelante y cierre asambleas de un
consorcio, con su orden del día, y que el quórum se calcule en vivo por
coeficiente a partir de la asistencia que confirman los vecinos y registra el
administrador.

## Alcance

**Entra:** ABM de asambleas, orden del día, ciclo de estados, asistencia
(confirmación del vecino, registro del admin, poderes), quórum en vivo y URL
del acta.

**Queda afuera:**
- Crear votaciones. Los puntos `CON_VOTACION` quedan marcados; la votación la
  crea el módulo Votaciones.
- RabbitMQ y el recordatorio de 48 h (`asamblea.creada` / `asamblea.recordatorio`).
  Por ahora el aviso de convocatoria sale por el `Notificador` de `core/`.
- Subir el archivo del acta: sólo se guarda su URL.

No hay cambios de esquema: `asamblea`, `asistencia` y `punto_orden_dia` ya
existen en la base.

## Estructura

`src/modules/asambleas/`:

| Archivo | Responsabilidad |
|---|---|
| `asambleas.module.ts` | `TypeOrmModule.forFeature([Asamblea, PuntoOrdenDia, Asistencia, Unidad, UnidadUsuario])` e importa `ConsorciosModule` |
| `asambleas.controller.ts` | Rutas de ambos portales; el service recorta lo que ve cada rol |
| `asambleas.service.ts` | Reglas de negocio, transiciones, permisos |
| `asambleas.repository.ts` | Acceso a datos, transacciones, agregados de quórum |
| `quorum.ts` | Función pura que calcula el quórum a partir de las asistencias |
| `dto/` | DTOs de entrada y queries de listado |

Un solo módulo: el orden del día y la asistencia no tienen sentido sin la
asamblea, igual que los gastos dentro de `expensas`.

## Ciclo de vida

```
BORRADOR ──convocar──▶ CONVOCADA ──iniciar──▶ EN_CURSO ──cerrar──▶ CERRADA
                                                         └───────▶ CERRADA_SIN_QUORUM
```

| Acción | Desde | Reglas |
|---|---|---|
| Crear | — | Queda en `BORRADOR`. `fechaHora` futura. Modalidad `PRESENCIAL` exige `lugar`; `DIGITAL` exige `linkVideollamada`; `HIBRIDA` exige los dos. `quorumRequerido` entre 0 y 100 (default 60). Puede traer el orden del día. `creadaPor` = usuario actual. 404 si el consorcio no existe. |
| Editar | `BORRADOR` | Mismas validaciones que crear sobre el resultado final. |
| Reemplazar orden del día | `BORRADOR` | `PUT` con la lista completa; el orden se toma de la posición (1..n). Borra y reinserta en una transacción. |
| Eliminar | `BORRADOR` | Borra la asamblea (los puntos caen por cascada). |
| Convocar | `BORRADOR` | Exige al menos un punto y `fechaHora` futura. En una transacción crea una `asistencia` `SIN_RESPONDER` por cada unidad **activa** del consorcio, con `coeficienteAplicado` = coeficiente actual de la unidad (copia: el quórum no cambia si después se edita una unidad). Exige al menos una unidad activa. Después avisa a los vecinos vinculados por el `Notificador`, sin bloquear. |
| Iniciar | `CONVOCADA` | No exige quórum (se contempla la segunda convocatoria). |
| Cerrar | `EN_CURSO` | `CERRADA` si el quórum alcanzado ≥ requerido; si no, `CERRADA_SIN_QUORUM`. |
| Cargar acta | `CERRADA`, `CERRADA_SIN_QUORUM` | `actaUrl` (URL válida). |

Una acción desde un estado no permitido responde **409 Conflict** con un
mensaje que dice en qué estado está.

## Asistencia

Se puede modificar sólo con la asamblea en `CONVOCADA` o `EN_CURSO` (409 si no).

- **Vecino** — `PUT /asambleas/:id/asistencia` con `estado` ∈ {`ASISTE`,
  `NO_ASISTE`} y `unidadId` opcional. Si tiene una sola unidad en ese
  consorcio se infiere; si tiene varias y no la indica, 400; si indica una que
  no es suya, 403. No puede marcar `CON_PODER` ni `SIN_RESPONDER`.
- **Administrador** — `PATCH /asambleas/:id/asistencias/:unidadId` con
  cualquier `estado`. `CON_PODER` exige `apoderadoUnidadId`, que tiene que ser
  otra unidad con asistencia en la misma asamblea (400 si no). En cualquier otro
  estado `apoderadoUnidadId` se limpia.
- En los dos casos se guardan `confirmadaPor` = usuario y `confirmadaAt` = ahora.
  Si la unidad no tiene asistencia en esa asamblea, 404.

## Quórum

`calcularQuorum(asistencias, quorumRequerido)` en `quorum.ts`:

- `presente` = Σ `coeficienteAplicado` de las asistencias `ASISTE` y `CON_PODER`.
- `total` = Σ `coeficienteAplicado` de todas.
- `porcentaje` = `presente / total × 100`, redondeado a 2 decimales (0 si `total` es 0).
- `alcanzado` = `porcentaje ≥ quorumRequerido`.
- `faltanPuntos` = `max(0, requerido − porcentaje)`.
- `faltanUnidades` = cuántas unidades `SIN_RESPONDER`, tomando primero las de
  mayor coeficiente, hacen falta para alcanzar el requerido (0 si ya se alcanzó;
  `null` si ni con todas alcanza).
- `conteo` = cantidad de asistencias por estado.

Antes de convocar no hay asistencias: el detalle devuelve `quorum: null`.

## API

| Método y ruta | Rol | Descripción |
|---|---|---|
| `GET /asambleas` | ambos | Listado. Filtros `consorcioId`, `estado`, `anio`. Cada fila trae `quorumPorcentaje` (agregado `SUM` en el repository). Orden: `fechaHora` desc. |
| `GET /asambleas/:id` | ambos | Detalle con orden del día, quórum y últimas 10 confirmaciones (unidad, usuario, estado, apoderado). Al vecino además su propia asistencia. |
| `POST /asambleas` | admin | Crear |
| `PATCH /asambleas/:id` | admin | Editar |
| `DELETE /asambleas/:id` | admin | Eliminar |
| `PUT /asambleas/:id/orden-dia` | admin | Reemplazar orden del día |
| `POST /asambleas/:id/convocar` | admin | Convocar |
| `POST /asambleas/:id/iniciar` | admin | Iniciar |
| `POST /asambleas/:id/cerrar` | admin | Cerrar |
| `PATCH /asambleas/:id/acta` | admin | Cargar URL del acta |
| `GET /asambleas/:id/asistencias` | admin | Padrón completo de asistencia |
| `PATCH /asambleas/:id/asistencias/:unidadId` | admin | Registrar asistencia de una unidad |
| `PUT /asambleas/:id/asistencia` | vecino | Confirmar la propia asistencia |

"admin" = `@Roles(RolUsuario.ADMINISTRADOR)`; `SUPER_ADMIN` pasa por la
jerarquía de `RolesGuard`.

## Visibilidad

- El administrador ve todas las asambleas (mismo criterio que reclamos).
- El vecino ve sólo las de consorcios donde tiene una unidad con vínculo
  vigente, y nunca las `BORRADOR`. Cualquier otra responde **404** (no 403,
  para no confirmar que existe).

## Errores

| Caso | Respuesta |
|---|---|
| Asamblea o consorcio inexistente / no visible | 404 |
| Acción no permitida en el estado actual | 409 |
| Validación de DTO, modalidad sin lugar/link, fecha pasada, poder sin apoderado | 400 |
| Vecino sobre unidad ajena | 403 |

El aviso de convocatoria nunca corta la operación: si el `Notificador` falla,
la asamblea queda convocada igual.

## Tests

- `quorum.spec.ts`: sin asistencias, sólo `ASISTE`, con `CON_PODER`,
  `NO_ASISTE` no suma, redondeo, `faltanUnidades` (alcanzable, ya alcanzado,
  inalcanzable).
- `asambleas.service.spec.ts` con repository mockeado: validación por
  modalidad, edición sólo en borrador, convocar crea asistencias con copia de
  coeficiente y exige puntos, cerrar elige el estado según quórum, reglas de
  asistencia del vecino (inferencia, unidad ajena, estados prohibidos) y del
  admin (poder con apoderado válido), vecino no ve borradores.
