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

Cada historia está trazada a un requisito de negocio (BR) y a los casos de prueba de la tabla de casos del proyecto, y tiene al menos tres escenarios: el camino feliz, uno alternativo y uno de error. Las que dependen de un sistema externo suman el escenario de su falla. La prioridad MoSCoW de cada historia sale de la de su BR.

### HU 01. Pagar la boleta con Mercado Pago

Como vecino, quiero pagar mi boleta con Mercado Pago, para no tener que transferir y después avisarle a la administración.
**Traza:** BR 01. **Prioridad:** Must. **Casos:** PAG01 a PAG07, PAG09 a PAG11.

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

  Escenario: Mercado Pago rechaza el pago
    Dado una boleta emitida de mi unidad con saldo pendiente
    Cuando pago con una tarjeta que Mercado Pago rechaza
    Entonces veo "Pago rechazado" con el motivo y que no se realizó ningún cargo
    Y la boleta mantiene su saldo y su vencimiento
    Y puedo volver a intentar con otro medio de pago
```

### HU 02. Emitir la liquidación del mes

Como administrador, quiero emitir la liquidación sólo después de revisar las boletas, para no generar deuda con errores.
**Traza:** BR 02. **Prioridad:** Must. **Casos:** CON05, LIQ01 a LIQ08, LIQ11 a LIQ14.

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

  Escenario: Queda un período anterior sin emitir
    Dado una liquidación de septiembre sin emitir
    Y la liquidación de octubre previsualizada
    Cuando intento emitir la de octubre
    Entonces el sistema la rechaza con "Hay un período anterior sin emitir en este consorcio: emitilo primero"
```

### HU 03. Ajustar una boleta antes de emitir

Como administrador, quiero bonificar o cargar un monto puntual en una boleta, para corregir un caso sin cambiar el coeficiente de la unidad.
**Traza:** BR 02. **Prioridad:** Must. **Casos:** LIQ10.

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

  Escenario: El ajuste deja la boleta en negativo
    Dado una liquidación previsualizada con una boleta de 400 pesos
    Cuando le cargo un ajuste de menos 500 pesos con motivo
    Entonces el sistema lo rechaza porque la boleta quedaría con total negativo
```

### HU 04. Abrir un reclamo con fotos

Como vecino, quiero abrir un reclamo con fotos y seguir su estado, para no tener que reclamar varias veces.
**Traza:** BR 03. **Prioridad:** Must. **Casos:** REC01, REC02, REC09, SEG01, SEG02.

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

  Escenario: Saco una foto antes de enviar
    Dado un reclamo en carga con dos fotos subidas
    Cuando saco una de las fotos y envío el reclamo
    Entonces el reclamo queda con una sola foto
```

### HU 05. Atender un reclamo

Como administrador, quiero asignar un proveedor, cambiar la prioridad y el estado de un reclamo, para ordenar el trabajo y que el vecino sepa en qué está.
**Traza:** BR 03. **Prioridad:** Must. **Casos:** REC03, REC05 a REC08.

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

  Escenario: Mensaje en un reclamo resuelto
    Dado un reclamo resuelto
    Cuando intento responderle al vecino
    Entonces el sistema lo rechaza hasta que reabro el reclamo
```

### HU 06. Enterarme de lo que pasa en el edificio

Como vecino, quiero recibir un aviso cuando se emiten las expensas, se convoca una asamblea o se cierra una votación, para no depender de los carteles del ascensor.
**Traza:** BR 04. **Prioridad:** Should. **Casos:** LIQ09, NOV05, NOV06, MSG01 a MSG03.

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

  Escenario: El mismo evento llega dos veces
    Dado un evento de votación cerrada que ya se procesó
    Cuando el broker lo vuelve a entregar
    Entonces no se repite el mail ni la novedad en el muro
```

### HU 07. Votar en una votación del consorcio

Como vecino, quiero votar desde la app, para participar aunque no pueda ir a la asamblea.
**Traza:** BR 05. **Prioridad:** Should. **Casos:** VOT05 a VOT07, VOT09.

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

  Escenario: Padrón sólo de propietarios
    Dado una votación cuyo padrón incluye sólo a los propietarios
    Y que soy inquilino de mi unidad
    Cuando abro la votación
    Entonces la veo pero no puedo votar
```

### HU 08. Reservar un amenity

Como vecino, quiero reservar el SUM o la parrilla desde la app, para no coordinar por mensajes con el resto del edificio.
**Traza:** BR 06. **Prioridad:** Could. **Casos:** RES02 a RES04, RES08, RES11.

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

  Escenario: Reserva en un horario libre
    Dado un amenity que no requiere aprobación
    Cuando reservo un horario libre dentro de la franja del día
    Entonces la reserva queda aprobada y ocupa ese horario en el calendario
```

### HU 09. Ingresar al portal de mi rol

Como usuario, quiero ingresar con mi email y ver sólo lo que me corresponde, para que mis datos y los del edificio estén protegidos.
**Traza:** BR 08. **Prioridad:** Must. **Casos:** SES01 a SES05, USR08, SEG03.

```gherkin
Característica: Ingreso y alcance

  Escenario: Cada rol entra a su portal
    Dado un usuario con rol administrador
    Cuando ingresa con su email y su contraseña
    Entonces entra al panel general de sus consorcios

  Escenario: Credenciales incorrectas
    Cuando alguien ingresa con un email que no existe o una contraseña incorrecta
    Entonces ve el mismo mensaje en los dos casos

  Escenario: Recurso de otro consorcio
    Dado un administrador del consorcio A
    Cuando pide un reclamo del consorcio B
    Entonces el sistema responde como si no existiera
```

### HU 10. Cargar unidades y vincular vecinos

Como administrador, quiero cargar las unidades con su coeficiente y vincular a sus vecinos, para que cada uno vea sólo lo suyo.
**Traza:** BR 07. **Prioridad:** Must. **Casos:** UNI01 a UNI03, USR01 a USR03, USR09.

```gherkin
Característica: Unidades y vínculos

  Escenario: Coeficientes por encima del 100 %
    Dado un consorcio con 98 % de coeficientes asignados
    Cuando cargo una unidad con coeficiente 5
    Entonces el sistema la rechaza e indica cuánto queda disponible

  Escenario: Vecino nuevo
    Dado una unidad activa
    Cuando sumo un vecino nuevo con una contraseña inicial
    Entonces el vecino puede ingresar y ve esa unidad

  Escenario: Fin del vínculo
    Dado un inquilino vinculado a una unidad
    Cuando termino su vínculo
    Entonces el siguiente pedido que hace ya no le devuelve las expensas ni los reclamos de esa unidad
```

### HU 11. Mantener los datos de los vecinos

Como administrador, quiero buscar a los vecinos de mis consorcios, corregir sus datos y asignarles una contraseña nueva, para resolver pedidos sin intervención técnica.
**Traza:** BR 07. **Prioridad:** Must. **Casos:** USR04 a USR06.

```gherkin
Característica: Datos de los vecinos

  Escenario: Email repetido
    Dado un vecino de mi consorcio
    Cuando le cambio el email por uno que ya usa otra cuenta
    Entonces el sistema rechaza el cambio

  Escenario: Contraseña nueva
    Cuando le asigno una contraseña nueva a un vecino de mi consorcio
    Entonces el vecino ingresa con esa contraseña

  Escenario: Vecino de otro consorcio
    Dado un vecino que vive sólo en un consorcio que no administro
    Cuando lo busco por su email
    Entonces no aparece en los resultados
```

### HU 12. Mantener mi perfil y mis avisos

Como usuario, quiero editar mis datos, cambiar mi contraseña y elegir qué avisos recibo por mail, para no recibir lo que no me interesa.
**Traza:** BR 04. **Prioridad:** Should. **Casos:** PER01 a PER04.

```gherkin
Característica: Perfil

  Escenario: Cambio de contraseña con la actual equivocada
    Cuando cambio mi contraseña escribiendo mal la actual
    Entonces el cambio no se hace

  Escenario: Apagar una categoría de avisos
    Dado que apagué los mails de reclamos y reservas
    Cuando se resuelve uno de mis reclamos
    Entonces no recibo el mail
    Y sigo recibiendo los mails de las demás categorías

  Escenario: Edito mis datos
    Cuando cambio mi nombre y mi teléfono desde Perfil
    Entonces se guardan y Perfil muestra los datos nuevos
```

### HU 13. Dar de alta consorcios y administradores

Como superadministrador, quiero crear consorcios, asignarles un administrador y darlos de baja cuando corresponda, para operar la plataforma.
**Traza:** BR 07. **Prioridad:** Must. **Casos:** CON01 a CON04.

```gherkin
Característica: Consorcios

  Escenario: Alta con administrador nuevo
    Cuando creo un consorcio y, en el mismo formulario, un administrador nuevo
    Entonces el administrador ve el consorcio en su selector

  Escenario: Baja de un consorcio
    Cuando apago el interruptor Activo de un consorcio
    Entonces aparece como inactivo en el listado
    Y puedo reactivarlo

  Escenario: Un administrador intenta crear un consorcio
    Dado un usuario con rol administrador
    Cuando pide crear un consorcio por la API
    Entonces el sistema responde 403 y no crea nada
```

### HU 14. Mantener los catálogos

Como administrador, quiero administrar las categorías de reclamo, los proveedores y los rubros de gasto de mi consorcio, para clasificar reclamos y gastos.
**Traza:** BR 03. **Prioridad:** Must. **Casos:** CAT01 a CAT04.

```gherkin
Característica: Catálogos

  Escenario: Categoría en uso
    Dado una categoría de reclamo que usa algún reclamo
    Cuando intento borrarla
    Entonces el sistema lo rechaza

  Escenario: Proveedor dado de baja
    Dado un proveedor dado de baja
    Cuando intento asignarlo a un reclamo o a un gasto
    Entonces el sistema lo rechaza

  Escenario: Nombre repetido
    Dado una categoría "Plomería" que ya veo en mi consorcio
    Cuando creo otra categoría "Plomería"
    Entonces el sistema la rechaza con "Ya existe una categoría Plomería"
```

### HU 15. Seguir la cobranza y registrar pagos manuales

Como administrador, quiero ver quién pagó, registrar las transferencias y recordarles el vencimiento a los que deben, para cobrar a tiempo.
**Traza:** BR 01. **Prioridad:** Must. **Casos:** PAG08, PAG12 a PAG14.

```gherkin
Característica: Cobranzas

  Escenario: Pago mayor al saldo
    Dado una boleta con saldo de 400 pesos
    Cuando registro un pago por transferencia de 500 pesos
    Entonces el sistema lo rechaza porque supera el saldo

  Escenario: Recordatorios
    Cuando envío los recordatorios de vencimiento
    Entonces les llegan sólo a los vecinos que todavía tienen saldo

  Escenario: Pago por transferencia por el saldo
    Dado una boleta con saldo de 400 pesos
    Cuando registro un pago por transferencia de 400 pesos
    Entonces la boleta pasa a pagada
    Y el pago tiene su recibo con número correlativo
```

### HU 16. Administrar los amenities

Como administrador, quiero configurar los amenities, aprobar reservas, bloquear fechas por mantenimiento y registrar las señas devueltas, para ordenar el uso de los espacios comunes.
**Traza:** BR 06. **Prioridad:** Could. **Casos:** RES01, RES05 a RES07, RES09, RES10.

```gherkin
Característica: Administración de amenities

  Escenario: Reserva con aprobación
    Dado un amenity que requiere aprobación
    Cuando un vecino reserva
    Entonces la reserva queda pendiente y recibo la notificación
    Y puedo aprobarla o rechazarla con un motivo

  Escenario: Bloqueo que pisa reservas
    Dado dos reservas aprobadas el sábado
    Cuando bloqueo el sábado por mantenimiento
    Entonces el sistema me avisa que hay reservas en esas fechas
    Y sólo bloquea si confirmo cancelarlas

  Escenario: Pendiente que nadie aprobó
    Dado una reserva pendiente de aprobación
    Cuando llega su horario de inicio sin que nadie la apruebe
    Entonces la reserva queda rechazada y el horario se libera
```

### HU 17. Convocar y realizar una asamblea

Como administrador, quiero convocar una asamblea, registrar la asistencia y los poderes, y cargar el acta, para que las decisiones queden respaldadas.
**Traza:** BR 05. **Prioridad:** Should. **Casos:** ASA01 a ASA11.

```gherkin
Característica: Asambleas

  Escenario: Convocatoria
    Dado una asamblea en borrador con su orden del día
    Cuando la convoco
    Entonces los vecinos reciben la citación por mail y aparece en el muro
    Y ya no se puede editar ni borrar

  Escenario: Quórum
    Dado una asamblea en curso
    Cuando registro la asistencia de las unidades
    Entonces el quórum se actualiza en vivo
    Y al cerrarla queda cerrada o cerrada sin quórum según corresponda

  Escenario: Cerrar con votaciones abiertas
    Dado una asamblea en curso con una votación abierta
    Cuando intento cerrar la asamblea
    Entonces el sistema responde "Cerrá primero las votaciones abiertas de esta asamblea"
```

### HU 18. Crear y cerrar una votación

Como administrador, quiero crear votaciones, cargar los votos presenciales y cerrarlas, para que el resultado respete la mayoría elegida.
**Traza:** BR 05. **Prioridad:** Should. **Casos:** VOT01 a VOT04, VOT08, VOT10 a VOT12.

```gherkin
Característica: Administración de votaciones

  Escenario: Publicar
    Dado una votación independiente en borrador
    Cuando la publico
    Entonces los vecinos reciben el mail y aparece en el muro
    Y ya no se puede editar

  Escenario: Cierre por fecha
    Dado una votación independiente que pasó su fecha de cierre
    Cuando alguien la consulta
    Entonces está cerrada y su resultado respeta la mayoría elegida

  Escenario: Opción repetida
    Dado una votación en borrador
    Cuando agrego una opción "A favor"
    Entonces el sistema la rechaza porque está repetida o es una de las fijas
```

### HU 19. Publicar y leer novedades

Como administrador, quiero publicar comunicados en el muro del edificio y saber cuántos vecinos los leyeron, para que la información llegue a todos.
**Traza:** BR 04. **Prioridad:** Should. **Casos:** NOV01 a NOV04.

```gherkin
Característica: Muro de novedades

  Escenario: Comunicado con adjunto
    Cuando publico un comunicado con un adjunto
    Entonces los vecinos lo ven en el muro y les llega por mail

  Escenario: Lecturas
    Dado un comunicado publicado
    Cuando un vecino lo lee
    Entonces veo cuántos vecinos lo leyeron

  Escenario: Novedad dada de baja
    Dado una novedad publicada
    Cuando la doy de baja
    Entonces deja de verse en el muro de los vecinos
```

### HU 20. Ver mi situación al entrar

Como vecino, quiero ver al entrar mi boleta del mes, los próximos eventos y las últimas novedades, para saber qué tengo pendiente sin recorrer toda la app.
**Traza:** BR 01. **Prioridad:** Should. **Casos:** INI01 a INI04.

```gherkin
Característica: Inicio del vecino

  Escenario: Resumen al entrar
    Dado que tengo una boleta emitida y una asamblea convocada
    Cuando entro a la app
    Entonces veo el saldo de la boleta, la asamblea entre los próximos eventos y las últimas novedades

  Escenario: Ir a un evento
    Cuando toco un próximo evento
    Entonces me lleva a su reserva, asamblea o votación

  Escenario: Unidad sin boletas emitidas
    Dado que mi unidad todavía no tiene boletas emitidas
    Cuando entro a la app
    Entonces la tarjeta de expensas dice "Todavía no hay expensas emitidas para tu unidad"
```

### HU 21. Ver el estado de todos mis consorcios

Como administrador, quiero un panel con la cobranza y lo que requiere atención en todos mis consorcios, para decidir por dónde empezar el día.
**Traza:** BR 01. **Prioridad:** Should. **Casos:** PAN01, PAN02.

```gherkin
Característica: Panel general

  Escenario: Resumen de la administración
    Dado que administro dos consorcios
    Cuando entro al panel general
    Entonces veo la cobranza de los últimos seis meses, lo que requiere atención y la actividad de hoy
    Y puedo exportar a Excel la tabla de mis consorcios

  Escenario: Ir a un pendiente
    Dado un pendiente de otro consorcio en "Requiere tu atención"
    Cuando lo toco
    Entonces la app cambia al consorcio de ese pendiente y abre su pantalla

  Escenario: Administrador sin consorcios
    Dado un administrador sin consorcios asignados
    Cuando ingresa
    Entonces ve "Todavía no tenés consorcios"
```

## 3. Reglas de negocio

| ID | Regla | Dónde se aplica |
|---|---|---|
| RN 01 | Los coeficientes de las unidades activas de un consorcio no pueden pasar el 100 %. Para previsualizar por coeficiente tienen que sumar exactamente 100 %. | Unidades, liquidación |
| RN 02 | Cada gasto se reparte por coeficiente o, si el criterio es partes iguales, entre las unidades activas. Los centavos que sobran se reparten por resto mayor, así la suma de las boletas coincide al centavo con el total. | Liquidación |
| RN 03 | Una liquidación sólo se emite si está previsualizada (si no, la API responde 409 Conflict), y no se emite si queda un período anterior sin emitir. | Liquidación |
| RN 04 | Una liquidación emitida no se modifica: sus boletas son deuda, y cualquier cambio responde 409 Conflict. Las correcciones van como ajuste en la liquidación siguiente. | Liquidación |
| RN 05 | Un ajuste manual exige motivo y no puede dejar ninguna boleta con total negativo. | Liquidación |
| RN 06 | El vencimiento por defecto es el día de vencimiento del consorcio en el mes siguiente al período, o el último día si ese mes es más corto. | Liquidación |
| RN 07 | La mora es interés simple sobre el saldo anterior; si la periodicidad es mensual se prorratea por día. | Liquidación |
| RN 08 | Sólo se paga la última boleta emitida de la unidad, porque las anteriores ya viajan como saldo anterior. No se acepta un pago mayor al saldo. | Pagos |
| RN 09 | Hay un solo titular vigente por unidad. | Unidades |
| RN 10 | Un vínculo terminado hoy ya no cuenta como vigente: desde el pedido siguiente, el vecino no ve esa unidad. | Unidades |
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
| RNF 09 | Usabilidad | Las pantallas se usan sin desplazamiento horizontal a 360, 768 y 1280 px de ancho. El portal del vecino está pensado primero para el celular. |
| RNF 10 | Compatibilidad | API REST documentada con OpenAPI (Swagger, disponible en desarrollo). |
| RNF 11 | Portabilidad | Toda la configuración (base, broker, mail, Mercado Pago) se toma de variables de entorno. |

## 5. Prototipo

El prototipo del front está en el repositorio, en `docs/diseno-front.html`: tiene las pantallas y los flujos que se usaron como guía visual para implementar la app.

## 6. Matriz de trazabilidad

Cada caso de prueba de la tabla de casos del proyecto aparece en una fila: los 117 quedan trazados a un requisito de negocio y a una historia de usuario. La última columna dice qué tests automáticos del backend cubren cada fila; las rutas son relativas a `apps/backend/src/modules`, salvo las que empiezan con `core/`, que lo son a `apps/backend/src`.

| BR | HU | Criterios | Casos de prueba | Componente | Tests automáticos |
|---|---|---|---|---|---|
| BR 01 | HU 01 | Pago aprobado, vuelta del checkout, aviso repetido, rechazo, reintegro, cobro de más, recibo, sólo la última boleta | PAG01, PAG02, PAG03, PAG04, PAG05, PAG06, PAG07, PAG09, PAG10, PAG11 | MercadoPagoClient, PagosService, EstadoCuentaService | pagos/pagos.service.spec.ts, pagos/mercado-pago.client.spec.ts, pagos/recibo.spec.ts |
| BR 01 | HU 15 | Pago manual, grilla, cabecera y recordatorios | PAG08, PAG12, PAG13, PAG14 | PagosService, ExpensasService | pagos/pagos.service.spec.ts, expensas/cobranzas.spec.ts |
| BR 01 | HU 20 | Inicio y Mis expensas del vecino | INI01, INI02, INI03, INI04 | InicioService, EstadoCuentaService | inicio/inicio.service.spec.ts |
| BR 01 | HU 21 | Panel general | PAN01, PAN02 | PanelService, EstadoCuentaService | panel/panel.service.spec.ts, panel/indicadores.spec.ts |
| BR 02 | HU 02 | Vencimiento, gastos, cuotas, origen, coeficientes, fondo, comparación, emisión en orden, mora, cierre y PDF | CON05, LIQ01, LIQ02, LIQ03, LIQ04, LIQ05, LIQ06, LIQ07, LIQ08, LIQ11, LIQ12, LIQ13, LIQ14 | ExpensasService, estados de la liquidación, prorrateo | expensas/estado-liquidacion.spec.ts, expensas/expensas.service.spec.ts, expensas/prorrateo.spec.ts |
| BR 02 | HU 03 | Ajuste con y sin motivo | LIQ10 | ExpensasService, prorrateo | expensas/expensas.service.spec.ts, expensas/prorrateo.spec.ts |
| BR 03 | HU 04 | Reclamo con fotos, fotos descartadas, reclamos ajenos y archivos | REC01, REC02, REC09, SEG01, SEG02 | ReclamosService, ArchivosService | reclamos/reclamos.service.spec.ts, archivos/archivos.service.spec.ts, archivos/tipos-archivo.spec.ts |
| BR 03 | HU 05 | Proveedor, nota interna, resolución, reapertura y bandeja | REC03, REC05, REC06, REC07, REC08 | ReclamosService | reclamos/reclamos.service.spec.ts |
| BR 03 | HU 14 | Categorías, proveedores y rubros | CAT01, CAT02, CAT03, CAT04 | CategoriasReclamoService, ProveedoresService, RubrosGastoService | categorias-reclamo/categorias-reclamo.service.spec.ts, proveedores/proveedores.service.spec.ts, rubros-gasto/rubros-gasto.service.spec.ts |
| BR 04 | HU 06 | Avisos por mail, campana y mensajería | LIQ09, NOV05, NOV06, MSG01, MSG02, MSG03 | PublicadorEventos, EmailNotificador, BandejaNotificaciones, Consumidor | core/mensajeria/despacho.spec.ts, email/email.service.spec.ts, bandeja/bandeja.service.spec.ts |
| BR 04 | HU 12 | Perfil, contraseña y preferencias de aviso | PER01, PER02, PER03, PER04 | UsuariosService, EmailNotificador | usuarios/usuarios.service.spec.ts, usuarios/preferencias.spec.ts, core/notificaciones/categorias.spec.ts |
| BR 04 | HU 19 | Comunicados, fijados, lecturas y bajas | NOV01, NOV02, NOV03, NOV04 | NovedadesService | novedades/novedades.service.spec.ts, novedades/muro.spec.ts |
| BR 05 | HU 07 | Un voto por unidad, padrón, deuda y voto anticipado | VOT05, VOT06, VOT07, VOT09 | VotacionesService, EstadoCuentaService | votaciones/votaciones.service.spec.ts, votaciones/padron.spec.ts |
| BR 05 | HU 17 | Convocatoria, modalidad, borrador, recordatorio, asistencia, poderes, quórum, cierre y acta | ASA01, ASA02, ASA03, ASA04, ASA05, ASA06, ASA07, ASA08, ASA09, ASA10, ASA11 | AsambleasService, RecordatorioAsambleas | asambleas/asambleas.service.spec.ts, asambleas/quorum.spec.ts, asambleas/acta-pdf.spec.ts |
| BR 05 | HU 18 | Publicación, borrador, opciones, adjunto, conteo parcial, votos presenciales y cierre | VOT01, VOT02, VOT03, VOT04, VOT08, VOT10, VOT11, VOT12 | VotacionesService | votaciones/votaciones.service.spec.ts, votaciones/escrutinio.spec.ts |
| BR 06 | HU 08 | Horario del día, turnos, capacidad, deuda y cancelación | RES02, RES03, RES04, RES08, RES11 | ReservasService | reservas/reservas.service.spec.ts, reservas/horario.spec.ts |
| BR 06 | HU 16 | Configuración, aprobación, vencimiento de pendientes, calendario, señas y bloqueos | RES01, RES05, RES06, RES07, RES09, RES10 | ReservasService | reservas/reservas.service.spec.ts |
| BR 07 | HU 10 | Unidades, coeficientes, vecinos y vínculos | UNI01, UNI02, UNI03, USR01, USR02, USR03, USR09 | UnidadesService, UsuariosService | unidades/unidades.service.spec.ts, unidades/vigencia.spec.ts |
| BR 07 | HU 11 | Búsqueda, datos y contraseña de los vecinos | USR04, USR05, USR06 | UsuariosService | usuarios/usuarios.service.spec.ts |
| BR 07 | HU 13 | Alta y baja de consorcios | CON01, CON02, CON03, CON04 | ConsorciosService, UsuariosService | consorcios/consorcios.service.spec.ts |
| BR 08 | HU 09 | Ingreso, sesión y alcance | SES01, SES02, SES03, SES04, SES05, USR08, SEG03 | AuthService, JwtAuthGuard, RolesGuard | auth/auth.service.spec.ts, auth/limitador-login.spec.ts, auth/alcance.spec.ts |
