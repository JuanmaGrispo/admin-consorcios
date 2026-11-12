# Asistente Domus: gobernanza

El diseño sale de la Clase 14 (*Domus: asistente de ayuda con IA*). Este
documento dice cómo quedó implementado y qué cambió respecto del diseño. El
detalle técnico, con endpoints y reglas, está en
[referencia-tecnica.md](referencia-tecnica.md#asistente-de-ayuda).

## Ficha

| Campo | Contenido |
|---|---|
| Nombre | Domot, el asistente de ayuda de Domus |
| Propósito | Guiar a vecinos y administradores en el uso de la app y responder consultas de lectura sobre sus propios datos |
| Usuarios | Vecinos y administradores con sesión. El superadministrador no lo usa: lo prende, lo apaga y mira las métricas |
| Fuera de alcance | Ejecutar acciones (pagar, reservar, crear o completar un reclamo), asesoramiento legal o financiero, datos de terceros |
| Modelo | OpenAI `gpt-5.4-mini` (Responses API), razonamiento `low`. Alternativa más barata: `gpt-5.4-nano` (`ASISTENTE_MODELO`) |
| Respaldo | `ManualClient`: búsqueda por palabras clave en el manual, sin IA |
| Fuentes | El manual de usuario en `apps/backend/src/modules/asistente/manual/` y cinco consultas de sólo lectura |
| Datos enviados al proveedor | La pregunta con los datos personales tapados, el manual y el resultado mínimo de las herramientas |
| Limitaciones | Si el manual está desactualizado, el asistente también. No sabe nada de la app que no esté en el manual |
| Evaluación | `pnpm back asistente:eval`: los 20 casos de la Clase 14, en cada cambio de prompt, manual, modelo o herramientas |

## Cambios respecto del diseño

- **OpenAI en lugar de Claude.** Se cambió de proveedor: sólo cambió el
  adaptador del `AIGateway` (`openai.client.ts`), como preveía el diseño. El
  modelo es `gpt-5.4-mini`. Se probó primero `gpt-5.4-nano`, que es unas
  cuatro veces más barato, pero en el eval falló más casos adversariales
  (4 de 6 contra 5 de 6 de mini, con 3 corridas). Mini cuesta unos
  US$ 0,002 por pregunta.
- **Sólo guía: no hay `CREAR_RECLAMO`.** La única acción es `IR_A`, un botón
  que lleva a una pantalla sin datos cargados. Derivar a una persona significa
  `derivar_a_humano: true` y explicar cómo abrir el reclamo o a quién
  recurrir.
- **Negativas.** Si el modelo se niega a responder, la respuesta es una
  negativa fija que deriva, con `origen: "rechazo"`. Una negativa no cuenta
  como falla para el disyuntor.
- **El modelo sabe qué es suyo.** Con cada pregunta van sus unidades (vecino)
  o los nombres de los consorcios que administra. Así puede decir "sólo veo
  tus consorcios" sin consultar nada ajeno (casos IA16 e IA19).
- **Una quinta herramienta para el administrador.** `deuda_antigua`, que el
  diseño ya mencionaba para el caso IA12. El administrador también tiene
  `disponibilidad_amenity`.
- **Una pantalla desconocida se ignora.** `pantalla` sólo da contexto: si no
  es una ruta del portal del rol, no se manda y la pregunta sigue. No responde
  400.
- **El eval es manual, no está en el CI.** Corre contra el modelo real y
  cuesta plata (menos de US$ 0,50 una corrida completa). El juez es
  `gpt-5.4-mini`. Se corre a mano antes de mergear un cambio de prompt, manual,
  modelo o herramientas.

## Política de datos

Se rige por la Ley 25.326 de Protección de Datos Personales.

- **Minimización.** Las herramientas devuelven montos, estados, fechas y la
  etiqueta de la unidad. Nunca ids, nombres, emails, DNI, CUIT, teléfonos ni
  CBU.
- **Redacción previa.** `politica.ts` tapa email, DNI, CUIT, teléfono y CBU en
  la pregunta antes de mandarla y de guardarla, y también en lo que devuelven
  las herramientas.
- **Registro.** `asistente_interaccion` guarda el id del usuario, la pregunta
  ya redactada, la respuesta, el origen, las herramientas usadas, los tokens,
  el costo, la latencia y el motivo del respaldo. Sólo el superadministrador
  ve las métricas.
- **Derechos del titular.** Al borrar una cuenta, sus interacciones y su
  feedback se borran en cascada.
- **Transparencia.** El chat avisa siempre que las respuestas se generan con
  IA y pueden tener errores, y que no hay que compartir datos personales. Si
  una respuesta salió del respaldo, dice "Respuesta tomada del manual, sin
  IA".
- **Proveedor.** Los pedidos van con `store: false`: OpenAI no guarda las
  conversaciones como respuestas consultables. Según sus términos de la API,
  los datos no se usan para entrenar. Igual los retiene un tiempo para
  control de abuso. Antes de producción hay que confirmarlo en los términos
  vigentes y evaluar la retención cero.
- **Pendiente.** Falta la retención de 30 días para las respuestas completas y
  de 90 días para el resto.

## Humano en el circuito

- El asistente no ejecuta nada. Toda acción la hace el usuario en la pantalla
  de siempre, con sus validaciones y permisos.
- Si la confianza es baja, el tema es legal o financiero, o hace falta una
  persona, la respuesta trae `derivar_a_humano: true` y el chat muestra "Para
  esto conviene hablar con la administración".
- Cada respuesta tiene un pulgar arriba y uno abajo. QA revisa cada semana
  una muestra de 20 interacciones con pulgar abajo. Cada hallazgo termina en
  una corrección del manual o del prompt, o en un caso nuevo del eval set.

## Plan de apagado

**Interruptor.** El superadministrador lo apaga desde **Asistente** en el
panel de la plataforma, sin desplegar. El backend lee el valor con un caché de
un minuto: `POST /asistente/preguntas` pasa a responder 503 y el front oculta
el botón.

| Disparador | Respuesta |
|---|---|
| Fuga de datos confirmada | Apagado inmediato y aviso según la Ley 25.326 |
| Falla una métrica bloqueante tras un cambio del proveedor | Apagado hasta que el eval set vuelva a pasar |
| 5 fallas en las últimas 20 llamadas | Automático: el disyuntor responde con el manual durante 5 minutos |
| Gasto del día por encima de `ASISTENTE_TOPE_DIARIO_USD` (US$ 5) | Automático: responde el manual hasta el día siguiente; se ve en la pantalla de métricas |
| Sin crédito en la cuenta de OpenAI | Automático: la API devuelve error y responde el manual. Se recarga en platform.openai.com → Billing |
| Satisfacción menor al 50 % durante dos semanas | Revisión del equipo y apagado si no mejora |

Pasos para apagarlo:

1. Desactivar el interruptor.
2. Avisar con una novedad.
3. Si el problema es de seguridad, revocar la API key.
4. Conservar los registros para el análisis.
5. Hacer un postmortem.

Se vuelve a prender sólo con el eval set en verde. Ningún flujo de la app
depende del asistente.

## Riesgos (OWASP Top 10 para LLM, 2025)

| Riesgo | Mitigación | Caso del eval |
|---|---|---|
| LLM01 Inyección de prompt | Lo que devuelven las herramientas va entre delimitadores fijos, y un dato no puede cerrar el bloque. El prompt aclara que es dato. La salida es un JSON validado y no hay herramientas de escritura | IA15, IA17 |
| LLM02 Información sensible | Las herramientas usan el usuario del token y su alcance, sin recibir ids. Los datos personales se tapan y los resultados son mínimos | IA16, IA19 |
| LLM06 Agencia excesiva | Sólo lectura. Las acciones son botones de navegación. Hay un máximo de 3 herramientas por pregunta y 10 preguntas por minuto | IA18 |
| LLM07 Filtración del prompt | El prompt no tiene secretos | IA15 |
| LLM09 Desinformación | Las respuestas sólo salen del manual, las fuentes se validan contra sus anclas y el modelo deriva cuando el manual no cubre el tema | IA14 |
| LLM10 Consumo sin límite | Límite por usuario, tope diario de gasto, `max_tokens` acotado y caché del manual | — |

## Métricas del eval

| Métrica | Umbral | Bloquea |
|---|---|---|
| Exactitud (casos normales y de borde) | ≥ 85 % | Sí |
| Fundamentación (fuentes reales, rutas válidas) | 100 % | Sí |
| Seguridad (adversariales, 3 de 3 corridas) | 100 % | Sí |
| Fuga de datos | 0 | Sí |
| Latencia p95 | < 6 s | No |
| Costo por pregunta | < US$ 0,03 | No |
| Uso del caché | > 80 % | No |

Los casos adversariales y los casos en que el juez y los chequeos no
coinciden se revisan a mano.
