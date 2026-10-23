# Domus: documento de requisitos de negocio (BRD)

**Proyecto:** Domus, sistema de administración de consorcios
**Materia:** Desarrollo de Aplicaciones II, UADE
**Versión:** 1.0, octubre de 2026
**Público:** sponsor del proyecto, cátedra y equipo de desarrollo
**Estándar de referencia:** ISO/IEC/IEEE 29148:2018 (requisitos de negocio) e IIBA BABOK v3

## 1. Resumen ejecutivo

La administración de un consorcio hoy se resuelve con planillas de Excel, grupos de WhatsApp y avisos pegados en el ascensor. El administrador liquida expensas a mano, persigue transferencias por mail y no tiene un registro ordenado de los reclamos; el vecino no sabe cuánto debe ni en qué estado está su pedido.

Domus reemplaza todo eso por una aplicación web con dos portales sobre los mismos datos. El administrador gestiona varios edificios desde un solo panel: liquida, cobra por Mercado Pago, atiende reclamos, administra los amenities y organiza asambleas. El vecino hace todo su seguimiento desde el celular. Los requisitos de mayor prioridad son el cobro en línea sin carga manual y la liquidación automática de expensas.

## 2. Contexto y problema de negocio

- **Liquidación manual.** Repartir cada gasto por coeficiente, sumar fondo de reserva, saldo anterior e intereses se hace en planillas, con errores de redondeo y sin trazabilidad.
- **Cobranza lenta.** Los pagos llegan por transferencia y el administrador los imputa a mano después de que el vecino manda el comprobante.
- **Reclamos sin seguimiento.** Se pierden en conversaciones de WhatsApp; nadie sabe quién está a cargo ni cuánto tardó.
- **Comunicación dispersa.** Las citaciones a asamblea y los comunicados no llegan a todos, y no queda registro de quién los leyó.
- **Decisiones sin respaldo.** Las votaciones se cuentan a mano, sin padrón ni control de quórum verificable.

## 3. Objetivos medibles

| Objetivo | Métrica | Meta | Plazo |
|---|---|---|---|
| O1. Cobrar en línea sin carga manual | Pagos por Mercado Pago imputados a su boleta y con recibo sin intervención del administrador | 100 % | Desde el lanzamiento |
| O2. Liquidar sin planillas | Liquidaciones cuya suma de boletas coincide al centavo con el total de gastos | 100 % | Desde el lanzamiento |
| O3. Reducir el tiempo de liquidación | Tiempo desde el último gasto cargado hasta la emisión | Menos de 1 hora por consorcio | 3 meses de uso |
| O4. Reclamos trazables | Reclamos con línea de tiempo completa (estados, proveedor, respuestas) | 100 % | Desde el lanzamiento |
| O5. Avisos oportunos | Avisos de emisión, convocatoria y votación entregados por mail y en la app en menos de 5 minutos | 95 % | Desde el lanzamiento |
| O6. Adopción del cobro en línea | Monto cobrado por Mercado Pago sobre el total cobrado | 50 % | 6 meses de uso |

## 4. Alcance

**Incluye:**

- Consorcios, unidades funcionales con su coeficiente y vecinos (propietarios e inquilinos).
- Liquidación mensual de expensas, boletas en PDF, cobranzas y recordatorios de vencimiento.
- Pago con Mercado Pago, registro de pagos manuales y recibos con número correlativo.
- Reclamos con fotos, categorías, proveedores, prioridad y línea de tiempo.
- Reservas de amenities con horarios, aprobación, seña y bloqueos por mantenimiento.
- Asambleas con orden del día, asistencia, poderes, quórum y acta.
- Votaciones independientes o dentro de una asamblea, con padrón y mayorías.
- Muro de novedades y centro de notificaciones.
- Avisos por mail y en la app, enviados por mensajería asincrónica (RabbitMQ).
- Tres roles: superadministrador, administrador y vecino.

**Excluye:**

- Firma digital de actas de asamblea.
- Facturación electrónica e integración con AFIP o ARCA.
- Avisos por WhatsApp y notificaciones push (el diseño los prevé, pero no se implementan en esta versión).
- Aplicación móvil nativa: el portal del vecino es web y responsive.

## 5. Stakeholders y usuarios

| Stakeholder | Interés | Participación |
|---|---|---|
| Sponsor (administración de consorcios) | Reducir trabajo manual y mejorar la cobranza | Aprueba el alcance y los objetivos |
| Superadministrador | Operar la plataforma: alta de consorcios y administradores | Usuario |
| Administrador | Liquidar, cobrar y gestionar sus edificios desde un solo lugar | Usuario principal |
| Vecino (propietario o inquilino) | Saber cuánto debe, pagar fácil y seguir sus reclamos | Usuario |
| Proveedores | Recibir trabajos asignados con información clara | Indirecto |
| Mercado Pago | Procesar los cobros | Sistema externo |
| Cátedra | Evaluar el trabajo práctico | Revisor |
| Equipo de desarrollo | Construir y mantener el sistema | Ignacio Alcaraz, Patricio Vecino, Juanmanuel Grispo, Felipe Vega Torre, Martin Capece y Jose Garcia Olmos |

## 6. Requisitos de negocio

Priorizados con MoSCoW: **Must** es imprescindible para lanzar, **Should** es importante pero tiene alternativa manual, **Could** suma valor si hay tiempo y **Won't** queda fuera de esta versión.

| ID | Requisito | Métrica | Prioridad |
|---|---|---|---|
| BR 01 | El vecino paga sus expensas en línea y el pago queda registrado sin que la administración cargue nada a mano. | 100 % de los pagos por Mercado Pago imputados con recibo, sin intervención. | Must |
| BR 02 | El sistema liquida las expensas: reparte cada gasto por coeficiente y suma fondo de reserva, saldo anterior y mora. | 100 % de las liquidaciones cuadran al centavo con el total de gastos. | Must |
| BR 03 | Cada reclamo queda registrado con su estado, su proveedor y la conversación con el vecino. | 100 % de los reclamos con línea de tiempo completa. | Must |
| BR 04 | Los vecinos se enteran de cada hecho relevante del edificio sin mensajes manuales. | 95 % de los avisos entregados en menos de 5 minutos. | Should |
| BR 05 | Las asambleas y votaciones tienen padrón, quórum y resultado verificables. | 100 % de los votos atados a una unidad, uno por unidad. | Should |
| BR 06 | Los amenities se reservan sin superposiciones y con reglas claras de cancelación. | 0 reservas superpuestas sobre el mismo lugar. | Could |
| BR 07 | La estructura de cada edificio (consorcios, administradores, unidades, vecinos y catálogos) se administra desde la app, sin intervención técnica. | 100 % de las altas, bajas y cambios hechos desde la app; sólo el primer superadministrador se crea por línea de comandos. | Must |
| BR 08 | Cada persona accede sólo a lo que le corresponde: el administrador a sus consorcios y el vecino a sus unidades. | 0 accesos a datos de otro consorcio o de otra unidad en las pruebas de seguridad. | Must |
| BR 09 | Avisos por WhatsApp y notificaciones push. | Fuera de esta versión. | Won't |

## 7. Supuestos, restricciones y dependencias

**Supuestos:**

- Un consorcio equivale a un edificio.
- La liquidación es mensual y por consorcio; los gastos extraordinarios son un ítem más de la liquidación del mes.
- El coeficiente es fijo por unidad; los ajustes puntuales se hacen en la boleta, con motivo.
- El interés por mora es una tasa única por consorcio, diaria o mensual.

**Restricciones:**

- Base de datos única en PostgreSQL (Supabase), compartida por todos los módulos.
- Mercado Pago se usa sólo como medio de pago (checkout), no para suscripciones.
- El mail sale por SMTP con NodeMailer.

**Dependencias:**

- Mercado Pago para el cobro en línea.
- Un servidor SMTP para los avisos por mail.
- Supabase Storage para las fotos, comprobantes y actas.
- RabbitMQ (CloudAMQP) para la mensajería asincrónica.

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Mercado Pago no responde o el aviso de pago no llega | Un pago aprobado queda pendiente en Domus | Al volver del checkout la app consulta el pago; el webhook es idempotente |
| El servidor de mail falla o limita los envíos | Los vecinos no reciben avisos | Mensajería con reintentos y cola de mensajes fallidos; la operación no depende del mail |
| Un cambio de esquema afecta a varios módulos | Fallas en cascada | Migraciones versionadas y verificación de entidades contra la base |
| Datos personales expuestos | Daño a los vecinos y riesgo legal (Ley 25.326) | Control de acceso por rol y por alcance, lo ajeno responde 404 |
| Baja adopción del portal por parte de los vecinos | No se cumplen O1 y O6 | Tutorial de primer ingreso y avisos por mail con enlace directo |

## 9. Criterios de éxito y KPIs

| KPI | Cómo se mide | Meta |
|---|---|---|
| Pagos imputados sin intervención | Pagos de Mercado Pago aprobados con boleta y recibo, sobre el total de pagos de Mercado Pago | 100 % |
| Exactitud de la liquidación | Liquidaciones cuya suma de boletas coincide con el total de gastos | 100 % |
| Avisos a tiempo | Registros de envío con menos de 5 minutos entre el evento y el envío | 95 % |
| Trazabilidad de reclamos | Reclamos resueltos con al menos un evento por cambio de estado | 100 % |
| Adopción del cobro en línea | Monto cobrado por Mercado Pago sobre el total cobrado | 50 % a los 6 meses |

## 10. Glosario y aprobaciones

| Término | Significado |
|---|---|
| Consorcio | El edificio y el conjunto de sus propietarios. |
| Unidad funcional | Cada departamento, local o cochera del consorcio. |
| Coeficiente | Porcentaje del edificio que le corresponde a una unidad; reparte los gastos. |
| Expensas | Lo que paga cada unidad para cubrir los gastos del edificio. |
| Liquidación | El cálculo mensual de las expensas de un consorcio. |
| Boleta | Lo que debe una unidad en una liquidación, con su detalle. |
| Fondo de reserva | Porcentaje que se suma a las expensas ordinarias para gastos futuros. |
| Mora | Interés que se cobra sobre el saldo impago después del vencimiento. |
| Titular | El vecino responsable de la unidad ante el consorcio. |
| Amenity | Espacio común reservable: SUM, parrilla, cochera de visitas. |
| Quórum | Cantidad mínima de unidades presentes para que una asamblea decida. |
| Padrón | Las unidades habilitadas para votar en una votación. |

| Rol | Nombre | Fecha | Firma |
|---|---|---|---|
| Sponsor | | | |
| Responsable del equipo | | | |
