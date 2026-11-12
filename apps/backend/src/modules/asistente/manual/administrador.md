# Domus: manual del administrador

## Tu primera liquidación {#primera-liquidacion}

Antes de empezar: un consorcio con sus unidades cargadas, cuyos coeficientes
sumen 100 %, y ningún período anterior sin emitir. Vas a cargar los gastos del
mes, revisar las boletas y emitirlas.

1. En el menú, andá a **Liquidación** y tocá **Nueva liquidación**. Elegí el
   período.
2. Tocá **Agregar gasto** por cada gasto del mes: rubro, descripción, monto y, si
   lo tenés, el comprobante.
3. Tocá **Continuar a previsualización**. Domus calcula la boleta de cada unidad
   según su coeficiente.
4. Revisá la previsualización: unidades alcanzadas, suma de coeficientes (tiene
   que dar 100 %) y la comparación con el mes anterior. Si hace falta, cargá un
   ajuste en una boleta, con su motivo.
5. Tocá **Emitir boletas**. Las boletas pasan a ser deuda de cada unidad y los
   vecinos reciben el aviso por mail y en la app.
6. Seguí la cobranza en **Cobranzas**. Cuando termine el período, volvé a la
   liquidación y tocá **Cerrar liquidación**.

Una liquidación emitida no se puede editar ni borrar. Si hubo un error, se
corrige con un ajuste en la liquidación siguiente.

## Estados de una liquidación {#estados-liquidacion}

- **Borrador**: se están cargando los gastos.
- **Previsualización**: las boletas están calculadas y se pueden revisar.
- **Emitida**: las boletas son deuda y los vecinos las ven.
- **Cerrada**: el período terminó; las boletas siguen contando como deuda.

## Cómo cargar unidades y vincular vecinos {#unidades-vecinos}

1. Andá a **Consorcio y unidades** y creá cada unidad con su etiqueta y su
   coeficiente. Los coeficientes no pueden pasar el 100 %.
2. Tocá **Vecinos** en una unidad y después **Sumar vecino**.
3. Si el vecino no tiene cuenta, cargá sus datos y una contraseña inicial. Si ya
   tiene, buscalo por su email.
4. Indicá si es propietario o inquilino y si es el titular. Hay un solo titular
   por unidad.
5. Cuando alguien se muda, terminá su vínculo: deja de ver la unidad en el
   momento.

## Cómo corregir los datos de un vecino o darle una contraseña nueva {#datos-vecino}

Antes de empezar: que el vecino esté vinculado a una unidad de uno de tus
consorcios.

1. Andá a **Usuarios y vecinos** y buscalo por nombre, apellido o email. Sólo
   ves a los vecinos de tus consorcios.
2. En la fila del vecino, usá **Editar datos** para corregir nombre, teléfono o
   email. Con el email nuevo entra desde la próxima vez; no se puede usar uno que
   ya tiene otra cuenta.
3. Usá **Nueva contraseña** para asignarle una, por ejemplo si se la olvidó.
   Conviene que después la cambie desde su Perfil.

Dar de baja una cuenta le corresponde al superadministrador: si un vecino se
muda, terminá su vínculo con la unidad.

## Cómo registrar un pago por transferencia {#registrar-pago}

Antes de empezar: una boleta emitida con saldo.

1. Andá a **Cobranzas** y buscá la unidad.
2. Tocá **Registrar pago**, cargá el monto, el medio y la fecha.
3. El pago se registra aprobado y genera su recibo. No se puede cargar más que el
   saldo de la boleta.

## Cómo seguir la cobranza y enviar recordatorios {#cobranza}

Antes de empezar: una liquidación emitida.

1. En **Cobranzas** ves lo emitido, lo cobrado, el saldo pendiente y los
   intereses del período.
2. Filtrá por pendientes, pagados o vencidos, o buscá por unidad o por
   propietario. Podés exportar la grilla a Excel.
3. Tocá **Enviar recordatorios**: el aviso les llega sólo a quienes todavía
   tienen saldo.

## Cómo atender un reclamo {#atender-reclamo}

Antes de empezar: un reclamo abierto. Para asignarlo, un proveedor activo en
Catálogos.

1. Andá a **Reclamos**. La bandeja se ve como tablero o como lista.
2. Abrí un reclamo y usá las acciones del detalle: **Asignar proveedor**,
   **Estado**, **Prioridad** y **Marcar resuelto**.
3. Para responderle al vecino, escribí en el detalle. Para dejar algo sólo para
   la administración, usá **Nota interna**.

## Cómo administrar amenities y reservas {#amenities}

1. Andá a **Amenities y reservas** y tocá **Nuevo amenity**: horario por día,
   turnos, capacidad, seña, aprobación y plazo de cancelación.
2. En el calendario semanal aprobás o rechazás las reservas pendientes, y podés
   cancelar una aprobada que todavía no empezó.
3. Para mantenimiento, tocá **Bloquear fechas**. Si hay reservas en esas fechas,
   marcá la opción para cancelarlas: se les avisa a los vecinos.
4. Cuando una reserva con seña pagada termina, se cancela o se rechaza, aparece
   en **Señas a devolver**. Devolvé el dinero por fuera de la app y tocá
   **Marcar devuelta**: queda registrado y se le avisa al vecino.

## Cómo convocar una asamblea y cargar el acta {#asambleas}

Antes de empezar: unidades con vecinos vinculados, que forman el padrón.

1. Andá a **Asambleas**, tocá **Nueva asamblea** y cargá fecha, modalidad y orden
   del día.
2. Guardala como borrador y, cuando esté lista, tocá **Convocar** (o **Crear y
   citar** para hacer las dos cosas juntas): los vecinos reciben la citación y
   aparece en el muro. Una asamblea convocada ya no se edita ni se borra.
3. Si un propietario no puede ir, usá **Registrar poder** para que lo represente
   otra unidad del padrón.
4. El día de la asamblea tocá **Iniciar** y registrá la asistencia de cada
   unidad; el quórum se actualiza en vivo.
5. En las votaciones de la asamblea, usá **Cargar voto** para los votos
   presenciales de cada unidad.
6. Cerrá las votaciones y tocá **Cerrar asamblea**: queda cerrada o cerrada sin
   quórum, según corresponda.
7. Descargá el borrador del acta y, una vez firmada, usá **Subir acta**. Las
   asambleas cerradas con su acta forman el libro de actas.

## Cómo crear una votación {#votaciones}

1. Andá a **Votaciones** y tocá **Nueva votación**: independiente o dentro de una
   asamblea.
2. Definí opciones, mayoría, padrón y si bloquea a las unidades con deuda.
3. Tocá **Publicar votación**. Al terminar, **Cerrar votación** calcula el
   resultado y avisa a los vecinos.

## Cómo publicar una novedad {#publicar-novedad}

1. Andá a **Novedades** y tocá **Nueva novedad**.
2. Escribí el comunicado, sumá un adjunto si hace falta y elegí si queda fijado
   arriba.
3. Tocá **Publicar**: los vecinos la ven en el muro y les llega por mail.
4. Desde la lista podés editarla, fijarla o desfijarla, ver cuántos vecinos la
   leyeron y **Dar de baja** la que ya no corresponde.

## Cómo mantener los catálogos {#catalogos}

1. Andá a **Catálogos**. Tiene tres listas: categorías de reclamo, proveedores y
   rubros de gasto.
2. Usá **Nueva categoría**, **Nuevo proveedor** o **Nuevo rubro** para cargar los
   de tu consorcio. Las marcadas como compartidas las administra el
   superadministrador y las ven todos los consorcios.
3. Una categoría que ya usa algún reclamo, o un rubro que ya tiene gastos, no se
   puede borrar.
4. Un proveedor que deja de trabajar con el edificio se da de baja: ya no se
   puede asignar a reclamos ni a gastos.

## Cómo leer el panel general {#panel-general}

1. Al ingresar entrás al **Panel general**, que resume todos tus consorcios.
2. **Cobranza últimos 6 meses** compara lo emitido con lo cobrado.
3. La lista de lo que requiere atención te lleva directo a cada pendiente: al
   tocar uno, la app se para en el consorcio que corresponde.
4. **Actividad de hoy** muestra los reclamos abiertos, las reservas del día y las
   votaciones activas.
5. **Mis consorcios** tiene el estado de cobranza del período de cada edificio y
   se puede exportar a Excel.
6. La campana de **Notificaciones** muestra los avisos sin leer, por ejemplo una
   reserva que espera aprobación.
