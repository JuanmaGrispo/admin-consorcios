# Domus: manual de usuario (común a todos)

Versión 1.0, octubre de 2026. Transcripción del manual de usuario: cada
sección lleva su ancla entre llaves, que es lo que el asistente cita como
fuente. Si cambia la app, se cambia acá y se vuelve a correr el eval set.

## Antes de empezar {#antes-de-empezar}

Qué necesitás: un navegador actualizado (Chrome, Edge, Firefox o Safari), en la
computadora o en el celular. No hay que instalar nada.

Tu cuenta: no hay registro abierto. Al vecino lo da de alta la administración de
su edificio, con una contraseña inicial que conviene cambiar desde Perfil. Al
administrador lo da de alta el superadministrador.

Cómo ingresar: entrá a la dirección de Domus, escribí tu email y tu contraseña y
tocá **Ingresar**. Cada rol entra a su portal: el vecino, a su **Inicio**; el
administrador, al **Panel general**; el superadministrador, al panel de la
**Plataforma**.

## Estados de una boleta {#estados-boleta}

- **Pendiente**: emitida, sin pagos y todavía no venció.
- **Parcial**: tiene algún pago, pero queda saldo.
- **Vencida**: pasó el vencimiento con saldo; suma intereses en la boleta siguiente.
- **Pagada**: el saldo está cubierto.

## Estados de un reclamo {#estados-reclamo}

- **Nuevo**: recién abierto, nadie lo tomó todavía.
- **En curso**: la administración lo está trabajando.
- **Esperando proveedor**: tiene un proveedor asignado y se espera su visita.
- **Resuelto**: cerrado. Se puede reabrir si el problema sigue.

## Estados de una reserva {#estados-reserva}

- **Pendiente**: espera la aprobación de la administración. Ya ocupa el lugar.
- **Aprobada**: confirmada.
- **Rechazada**: la administración no la aprobó, con un motivo.
- **Cancelada**: la canceló el vecino o la administración.
- **Finalizada**: ya pasó.

## Cómo se calcula la boleta {#calculo-boleta}

Cada gasto del mes se reparte entre las unidades según su coeficiente: una
unidad con coeficiente 2,5 paga el 2,5 % de cada gasto. A eso se le suma el
fondo de reserva, que es un porcentaje de las expensas ordinarias. Si la boleta
anterior quedó con saldo, ese saldo se suma con intereses por los días de
atraso. El resultado se redondea al centavo de forma que la suma de todas las
boletas coincida exactamente con el total de gastos.

## Por qué sólo se paga la última boleta {#ultima-boleta}

Cada boleta nueva ya incluye lo que quedó sin pagar de la anterior, como saldo
anterior. Si se pudiera pagar una boleta vieja, la misma deuda se cobraría dos
veces. Por eso Domus sólo deja pagar la más reciente, y cuando queda pagada, las
anteriores también se dan por pagadas.

## Mensajes de error frecuentes {#errores-frecuentes}

- **La app vuelve a la pantalla de ingreso, sin mensaje.** La sesión venció o se
  cerró desde otra pestaña. Ingresá de nuevo; lo que estabas cargando y no
  guardaste se pierde.
- **"Email o contraseña incorrectos".** Alguno de los dos datos no coincide, o la
  cuenta está dada de baja. Revisá los datos. Si no recordás la contraseña,
  pedile a la administración que te asigne una nueva.
- **"Demasiados intentos fallidos. Probá de nuevo en N minutos."** Hubo 5
  intentos fallidos seguidos y la cuenta se bloqueó por seguridad. Esperá el
  tiempo indicado.
- **"Esta deuda ya está incluida en la boleta más reciente de la unidad: pagá
  esa".** Intentaste pagar una boleta vieja. Pagá la boleta más reciente desde
  Expensas.
- **"(Amenity) se cancela hasta N horas antes. Pedíselo a la administración."**
  Pasó el plazo de cancelación del amenity. Pedile a la administración que la
  cancele.
- **"La subida de archivos no está configurada".** El servidor no tiene
  configurado el almacenamiento de archivos. Avisale al soporte de Domus.
- **"Previsualizá las boletas antes de emitir".** Se intentó emitir una
  liquidación en borrador. Tocá Continuar a previsualización, revisá y después
  emití.
- **"Cargá al menos un gasto antes de calcular las boletas".** La liquidación no
  tiene gastos. Agregá los gastos del mes.
- **"Hay un período anterior sin emitir en este consorcio: emitilo primero".**
  Quedó una liquidación anterior sin emitir. Emití primero la del período
  anterior.
- **"Los coeficientes del consorcio pasarían el 100 %".** La unidad que cargás
  supera el total disponible. Revisá los coeficientes de las unidades.
- **"La unidad ya tiene un titular".** Se intentó cargar un segundo titular.
  Terminá el vínculo del titular actual o cargá al vecino sin marcarlo como
  titular.
- **"Indicá el motivo del ajuste: el vecino lo ve en su boleta".** Se cargó un
  ajuste sin motivo. Escribí el motivo.

## Pagué y la boleta sigue pendiente {#pago-pendiente}

Si al terminar en Mercado Pago no tocaste **Volver al sitio**, el pago puede
tardar en verse. Entrá a Expensas: si sigue pendiente, avisale a la
administración con el número de operación de Mercado Pago.

Si pagaste por transferencia o en efectivo, avisale a la administración: ese
pago lo registra ella desde Cobranzas, y recién ahí la boleta se actualiza.

## Tener más de una unidad {#varias-unidades}

Si sos propietario o inquilino de varias unidades, elegís cuál ver desde el menú
de la barra superior, en **Tus unidades**.

## No me llegan los mails {#no-llegan-mails}

Revisá la carpeta de correo no deseado y tus preferencias de aviso en Perfil.

## Soporte {#soporte}

Escribile a la administración de tu edificio. Los administradores pueden
contactar al equipo de Domus por el canal de la cátedra.
