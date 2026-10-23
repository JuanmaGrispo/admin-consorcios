# Domus: documentación funcional

**Versión:** 1.0, octubre de 2026
**Público:** analistas, QA y desarrollo
**Estándar de referencia:** ISO/IEC/IEEE 29148:2018 (especificación del software), historias INVEST con criterios Gherkin, ISO/IEC 25010:2023 (requisitos no funcionales)
**Relacionado:** [BRD](brd.md) para el porqué, [manual de usuario](manual-usuario.md) para el uso y la tabla de casos de prueba del documento del proyecto para la verificación.

## 1. Alcance y actores

Domus tiene tres actores, cada uno con su portal:

| Actor | Portal | Qué hace |
|---|---|---|
| Superadministrador | Plataforma | Da de alta consorcios y administradores. Puede entrar al portal de administración de cualquier consorcio. |
| Administrador | Administración | Gestiona sólo los consorcios que tiene asignados: unidades y vecinos, liquidación, cobranzas, reclamos, amenities, asambleas, votaciones y novedades. |
| Vecino | Vecino | Ve y paga las expensas de su unidad, abre reclamos, reserva amenities, vota y lee las novedades. |

Sistemas externos: Mercado Pago (cobro), servidor SMTP (mail), Supabase Storage (archivos) y RabbitMQ (mensajería). El alcance completo está en la sección 4 del BRD.

## 2. Historias de usuario

Cada historia está trazada a un requisito de negocio (BR) y a los casos de prueba (CP) de la tabla de casos del proyecto.

### HU 01. Pagar la boleta con Mercado Pago

Como vecino, quiero pagar mi boleta con Mercado Pago, para no tener que transferir y después avisarle a la administración.
**Traza:** BR 01. **Casos:** PAG01, PAG02, PAG05, PAG09.

```gherkin
Característica: Pago de expensas con Mercado Pago

  Escenario: Pago aprobado
    Dado una boleta emitida de mi unidad con saldo pendiente
    Cuando la pago con Mercado Pago y el pago queda aprobado
    Entonces la boleta pasa a pagada
    Y se genera el recibo con su número correlativo
    Y recibo el mail de pago recibido

  Escenario: Vuelvo del checkout antes que el aviso de Mercado Pago
    Dado un pago aprobado en Mercado Pago que todavía no avisó a Domus
    Cuando vuelvo a la app desde el checkout
    Entonces la app consulta el pago y lo muestra aprobado

  Escenario: Mercado Pago avisa dos veces el mismo pago
    Dado un pago que ya quedó aprobado
    Cuando llega otro aviso de Mercado Pago por ese pago
    Entonces no se duplica ni el pago ni el recibo
```

### HU 02. Emitir la liquidación del mes

Como administrador, quiero emitir la liquidación sólo después de revisar las boletas, para no generar deuda con errores.
**Traza:** BR 02. **Casos:** LIQ01, LIQ08, LIQ11, LIQ13.

```gherkin
Característica: Emisión de la liquidación

  Escenario: Emitir sin previsualizar
    Dado una liquidación en borrador con gastos cargados
    Cuando intento emitirla
    Entonces el sistema la rechaza con "Previsualizá las boletas antes de emitir"
    Y la liquidación sigue en borrador

  Escenario: Emitir una liquidación previsualizada
    Dado una liquidación previsualizada
    Cuando la emito
    Entonces pasa a emitida
    Y sus boletas quedan como deuda de cada unidad
    Y los vecinos reciben el aviso de expensas emitidas
```

### HU 03. Ajustar una boleta antes de emitir

Como administrador, quiero bonificar o cargar un monto puntual en una boleta, para corregir un caso sin cambiar el coeficiente de la unidad.
**Traza:** BR 02. **Casos:** LIQ10.

```gherkin
Característica: Ajuste manual de una boleta

  Escenario: Ajuste con motivo
    Dado una liquidación previsualizada
    Cuando le resto 100 pesos a la boleta de una unidad con el motivo "Bonificación"
    Entonces la diferencia se reparte entre las demás unidades
    Y el total de la liquidación no cambia

  Escenario: Ajuste sin motivo
    Dado una liquidación previsualizada
    Cuando cargo un ajuste sin motivo
    Entonces el sistema lo rechaza porque el vecino ve el motivo en su boleta
```

### HU 04. Abrir un reclamo con fotos

Como vecino, quiero abrir un reclamo con fotos y seguir su estado, para no tener que reclamar varias veces.
**Traza:** BR 03. **Casos:** REC01, REC02, REC09, SEG01.

```gherkin
Característica: Reclamos del vecino

  Escenario: Reclamo con fotos
    Dado que estoy vinculado a una unidad
    Cuando abro un reclamo con título, categoría, descripción y dos fotos
    Entonces el reclamo queda en estado nuevo con prioridad media
    Y recibo el mail de reclamo registrado

  Escenario: Un archivo que no es una imagen
    Cuando intento subir un ejecutable renombrado como foto
    Entonces el sistema lo rechaza y no lo guarda
```

### HU 05. Atender un reclamo

Como administrador, quiero asignar un proveedor, cambiar la prioridad y el estado de un reclamo, para ordenar el trabajo y que el vecino sepa en qué está.
**Traza:** BR 03. **Casos:** REC03, REC05, REC06, REC07.

```gherkin
Característica: Gestión de reclamos

  Escenario: Asignar un proveedor
    Dado un reclamo nuevo
    Cuando le asigno un proveedor
    Entonces el reclamo pasa a en curso
    Y el vecino recibe el aviso

  Escenario: Nota interna
    Cuando agrego una nota interna
    Entonces el vecino no la ve ni recibe aviso
```

### HU 06. Enterarme de lo que pasa en el edificio

Como vecino, quiero recibir un aviso cuando se emiten las expensas, se convoca una asamblea o se cierra una votación, para no depender de los carteles del ascensor.
**Traza:** BR 04. **Casos:** LIQ09, ASA01, VOT12, NOV05, MSG02.

```gherkin
Característica: Avisos a los vecinos

  Escenario: Se cierra una votación
    Dado una votación abierta de mi consorcio
    Cuando el administrador la cierra
    Entonces recibo un mail con el resultado
    Y veo la novedad en el muro
    Y tengo una notificación sin leer en la campana

  Escenario: El servidor de mail no responde
    Dado que el servidor de mail está caído
    Cuando se cierra la votación
    Entonces la votación queda cerrada igual
    Y el mail se reintenta sin repetir los que ya salieron
```

### HU 07. Votar en una votación del consorcio

Como vecino, quiero votar desde la app, para participar aunque no pueda ir a la asamblea.
**Traza:** BR 05. **Casos:** VOT05, VOT06, VOT07, VOT09.

```gherkin
Característica: Votación

  Escenario: Un voto por unidad
    Dado una votación publicada y mi unidad en el padrón
    Cuando voto "A favor"
    Entonces el voto queda registrado para mi unidad
    Y un segundo voto de la misma unidad se rechaza

  Escenario: Unidad con deuda vencida
    Dado una votación con bloqueo por deuda
    Y mi unidad con expensas vencidas
    Cuando intento votar
    Entonces el sistema no me deja votar
```

### HU 08. Reservar un amenity

Como vecino, quiero reservar el SUM o la parrilla desde la app, para no coordinar por mensajes con el resto del edificio.
**Traza:** BR 06. **Casos:** RES01, RES04, RES05, RES11.

```gherkin
Característica: Reservas de amenities

  Escenario: Horario ocupado
    Dado un amenity con un solo lugar y una reserva de 18 a 22
    Cuando intento reservar de 20 a 23
    Entonces el sistema rechaza la reserva

  Escenario: Cancelar fuera de plazo
    Dado una reserva aprobada que empieza en 3 horas
    Y un amenity que se cancela hasta 24 horas antes
    Cuando intento cancelarla
    Entonces el sistema me pide que se lo pida a la administración
    Y el administrador sí puede cancelarla
```

## 3. Reglas de negocio

| ID | Regla | Dónde se aplica |
|---|---|---|
| RN 01 | Los coeficientes de las unidades activas de un consorcio no pueden pasar el 100 %. Para previsualizar por coeficiente tienen que sumar exactamente 100 %. | Unidades, liquidación |
| RN 02 | Cada gasto se reparte por coeficiente o, si el criterio es partes iguales, entre las unidades activas. Los centavos que sobran se reparten por resto mayor, así la suma de las boletas coincide al centavo con el total. | Liquidación |
| RN 03 | Una liquidación sólo se emite si está previsualizada, y no se emite si queda un período anterior sin emitir. | Liquidación |
| RN 04 | Una liquidación emitida no se modifica: sus boletas son deuda. Las correcciones van como ajuste en la liquidación siguiente. | Liquidación |
| RN 05 | Un ajuste manual exige motivo y no puede dejar ninguna boleta con total negativo. | Liquidación |
| RN 06 | El vencimiento por defecto es el día de vencimiento del consorcio en el mes siguiente al período, o el último día si ese mes es más corto. | Liquidación |
| RN 07 | La mora es interés simple sobre el saldo anterior; si la periodicidad es mensual se prorratea por día. | Liquidación |
| RN 08 | Sólo se paga la última boleta emitida de la unidad, porque las anteriores ya viajan como saldo anterior. No se acepta un pago mayor al saldo. | Pagos |
| RN 09 | Hay un solo titular vigente por unidad. | Unidades |
| RN 10 | Terminar un vínculo corta el acceso del vecino a esa unidad en el momento. | Unidades |
| RN 11 | La prioridad de un reclamo la fija el administrador; el del vecino entra con prioridad media. | Reclamos |
| RN 12 | Un reclamo resuelto no acepta mensajes hasta que se reabre. | Reclamos |
| RN 13 | Cada unidad vota una sola vez por votación, y sólo si está en el padrón. | Votaciones |
| RN 14 | Una asamblea no se cierra mientras tenga votaciones abiertas. | Asambleas |
| RN 15 | El vecino cancela una reserva dentro del plazo del amenity; fuera de ese plazo, sólo la administración, hasta que la reserva empiece. | Reservas |
| RN 16 | Un bloqueo por mantenimiento que pisa reservas exige cancelarlas, y se les avisa a los vecinos. | Reservas |
| RN 17 | Un administrador sólo ve sus consorcios y un vecino sólo sus unidades. Lo ajeno responde como inexistente. | Todos |

## 4. Requisitos no funcionales

Clasificados según ISO/IEC 25010:2023.

| ID | Característica | Requisito |
|---|---|---|
| RNF 01 | Seguridad | La sesión viaja en una cookie httpOnly; el JavaScript del front nunca ve el token. |
| RNF 02 | Seguridad | Toda ruta exige sesión salvo las marcadas como públicas, y cada acción exige su rol. |
| RNF 03 | Seguridad | Después de 5 intentos de login fallidos en 15 minutos, la cuenta se bloquea 15 minutos (20 intentos por IP). |
| RNF 04 | Seguridad | Las contraseñas se guardan con bcrypt y los archivos se validan por su contenido. |
| RNF 05 | Fiabilidad | Si falla un aviso, se reintenta hasta tres veces y después queda en una cola de mensajes fallidos. La operación de negocio no depende del aviso. |
| RNF 06 | Fiabilidad | Los avisos de Mercado Pago y los mensajes repetidos no duplican pagos, recibos ni mails. |
| RNF 07 | Eficiencia | Ninguna operación del usuario espera el envío de un mail. Las grillas grandes se paginan. |
| RNF 08 | Mantenibilidad | Backend en capas (controller, service, repository) y más de 500 tests automáticos sobre la lógica de negocio. |
| RNF 09 | Usabilidad | El portal del vecino funciona en el celular (diseño responsive). |
| RNF 10 | Compatibilidad | API REST documentada con OpenAPI (Swagger, disponible en desarrollo). |
| RNF 11 | Portabilidad | Toda la configuración (base, broker, mail, Mercado Pago) se toma de variables de entorno. |

## 5. Prototipo

El prototipo navegable del front está en Figma: **[completar con el enlace de Figma]**.

En el repositorio, [docs/diseno-front.html](../diseno-front.html) tiene las pantallas y los flujos que se usaron como guía visual para implementar el front.

## 6. Matriz de trazabilidad

| BR | HU | Criterio | Casos de prueba | Componente |
|---|---|---|---|---|
| BR 01 | HU 01 | Pago aprobado | PAG01, PAG09 | MercadoPagoClient, PagosService |
| BR 01 | HU 01 | Vuelvo antes que el aviso | PAG02 | PagosService (sincronizar) |
| BR 01 | HU 01 | Aviso repetido | PAG05 | PagosService |
| BR 02 | HU 02 | Emitir sin previsualizar | LIQ08 | Estados de la liquidación |
| BR 02 | HU 02 | Emitir previsualizada | LIQ01, LIQ13 | ExpensasService, PublicadorEventos |
| BR 02 | HU 03 | Ajuste con y sin motivo | LIQ10 | ExpensasService, prorrateo |
| BR 03 | HU 04 | Reclamo con fotos | REC01, REC02 | ReclamosService, ArchivosService |
| BR 03 | HU 04 | Archivo que no es imagen | SEG01 | ArchivosService |
| BR 03 | HU 05 | Asignar proveedor y nota interna | REC03, REC05 | ReclamosService |
| BR 04 | HU 06 | Cierre de votación | VOT12, NOV05 | EmailNotificador, MuroNovedadesPublicador, BandejaNotificaciones |
| BR 04 | HU 06 | Mail caído | MSG02 | Consumidor (reintentos y cola de fallidos) |
| BR 05 | HU 07 | Un voto por unidad | VOT05, VOT06 | VotacionesService |
| BR 05 | HU 07 | Bloqueo por deuda | VOT07 | VotacionesService, EstadoCuentaService |
| BR 06 | HU 08 | Horario ocupado | RES04 | ReservasService |
| BR 06 | HU 08 | Cancelar fuera de plazo | RES11 | ReservasService |
