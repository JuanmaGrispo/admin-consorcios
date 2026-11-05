# Colección Postman y pruebas de contrato

## Colección Postman (Newman)

`apps/backend/acceptance/postman/domus.postman_collection.json` tiene al menos
un caso de éxito y uno de error por cada endpoint de la API: 127 endpoints (las
126 operaciones del OpenAPI más el webhook de Mercado Pago, que Swagger no
publica), 296 pedidos, 147 de éxito y 149 de error o de borde, y 445
aserciones. Cada pedido verifica el código de estado; los de error verifican
además que la respuesta sea `application/problem+json`.

- Los casos se editan en `casos.cjs` y la colección se regenera con
  `node acceptance/postman/generar-coleccion.cjs` (desde `apps/backend`). El
  generador falla si algún endpoint queda sin caso de éxito o sin caso de error.
- La colección se ejecuta sola, en orden: se loguea con cada rol, crea lo que
  necesita y lo usa en los pasos siguientes (liquidación de punta a punta,
  asamblea con votación presencial, reservas con seña, etc.). Las fechas se
  calculan sobre el día de la corrida.
- Corre sin cookies (`disableCookies`): cada pedido usa sólo su token. Con la
  cookie del último ingreso, los casos "sin sesión" no lo eran.
- El webhook se firma en el pre-request con HMAC-SHA256, igual que Mercado Pago.

Se ejecuta en la corrida integral con `--newman`
(`pnpm back test:aceptacion:integral --web --carga --newman --contrato` en la
CI), con la imagen `postman/newman:6.1.3-alpine`, después de la prueba web,
porque emite una liquidación nueva que reemplaza las boletas que usan los flujos
de Playwright. Variables que inyecta el runner: `baseUrl`, `password`,
`vecinoEmail`, `vecinoId`, `adminId`, `consorcioId`, `unidadId`, `unidad2Id`,
`categoriaId`, `boletaId`, `boleta2Id`, `notificacionId` y `mpSecret`. Reporte:
`apps/backend/acceptance/resultados/newman.xml` (artefacto del job integral).

También se puede importar en Postman: se cargan esas variables en un entorno y
se corre la colección completa (Run collection), no pedidos sueltos.

### Resultado local del 05/11/2026

Sobre ae1d41f más estos cambios, contra el backend real con PostgreSQL 17,
esquema, migraciones y fixtures de aceptación y los simuladores de Mercado Pago,
Storage y SMTP (sin RabbitMQ: la notificación de la bandeja la siembra el
runner). Newman 6.1.3: 296/296 pedidos y 445/445 aserciones en unos 10 s. Tres
corridas seguidas sobre una base limpia dieron el mismo resultado.

Falta la corrida en GitHub Actions.

## Pruebas de contrato (Schemathesis)

Con `--contrato`, Schemathesis 4.33.1 genera pedidos a partir del OpenAPI de
`/docs-json` (Swagger, disponible fuera de producción) con el token del
administrador y falla si alguna operación responde 5xx (`not_a_server_error`),
con 25 ejemplos por operación y generación determinística. Corre al final de la
integral porque escribe datos al azar. Excluye `POST /boletas/recordatorios`:
sin filtros manda un recordatorio a cada boleta impaga (3000 en la base de
aceptación) y con cuatro workers supera los 10 s del cliente. Es el
incumplimiento DIS01 de la matriz de seguridad, no un defecto nuevo. Reporte:
`apps/backend/acceptance/resultados/schemathesis.xml`.

Límites, medidos el 05/11:

- El OpenAPI no declara el esquema de ninguna respuesta (126 de 126), así que
  no se puede validar la forma de las respuestas, sólo los códigos.
- 84 operaciones rechazan casi todos los datos generados (lista blanca estricta
  y ids que no existen) y 62 responden sobre todo 404: la prueba ejercita sobre
  todo la validación y el manejo de errores, no los caminos felices. Esos los
  cubre la colección.
- 7 operaciones sólo responden 401 o 403 porque se corre con un solo rol.

### Hallazgos del 05/11/2026

- **DEF-16 (cerrado en local):** `pagina` sin tope. `GET /reclamos?pagina=9223372036854775808`
  (también novedades, boletas, reservas y notificaciones) responde 500:
  PostgreSQL rechaza el `OFFSET` (`bigint out of range`). Corrección: tope
  `PAGINA_MAXIMA` (10.000) en los cinco listados y `paginacion.spec.ts`.
- **DEF-17 (cerrado en local):** `POST /archivos` con el campo `archivo` dos
  veces respondía 500. Es una regresión de DEF-10: @nestjs/platform-express
  traduce los errores de multer por el texto del mensaje, y multer 2.5.0 (el
  override) cambió "Unexpected field" por "Unexpected file field". Corrección:
  el filtro de errores traduce `MulterError` por `code` (413 si el archivo es
  grande, 400 el resto). Lo encontró Schemathesis 3.39.
- **DEF-18 (cerrado en local):** un decimal que JavaScript escribe en notación
  exponencial responde 500 en los campos con `@IsNumber({ maxDecimalPlaces })`:
  `POST /unidades` con `"coeficiente": 0.0000001`. class-validator 0.14.4 hace
  `"1e-7".split('.')[1].length`. Afecta 7 campos (coeficiente y metros de
  unidades, quórum, monto de seña, ajuste, gasto y pago). Lo encontró
  Schemathesis 4.33 en `POST /unidades` y `POST /asambleas`. Corrección: el
  validador `@MaxDecimales(n)` (`core/max-decimales.ts`) compara contra el
  número redondeado con `toFixed`, en lugar de partir el texto por el punto.
  Tests en `max-decimales.spec.ts`.

Con DEF-16, DEF-17 y DEF-18 corregidos, Schemathesis 4.33.1 generó 7751
pedidos el 05/11 por la noche, sin ningún 5xx, en dos corridas con el mismo
resultado (unos 35 s cada una).

### Hallado al armar la colección

- **DEF-15:** un booleano mandado como texto en un cuerpo JSON se convierte en
  `true`. `PATCH /novedades/:id` con `{"fijada": "false"}` deja la novedad
  fijada. Causa: `enableImplicitConversion` del `ValidationPipe`. En los filtros
  de query no pasa porque usan `booleanoDeQuery`. La web manda booleanos reales.
- Observación sin defecto registrado: reservas y reclamos responden 400 a una
  transición de estado inválida (aprobar dos veces, cancelar una rechazada,
  pasar al mismo estado), mientras que liquidaciones, asambleas y votaciones
  responden 409. La colección registra el comportamiento actual.
