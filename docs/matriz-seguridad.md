# Matriz de seguridad — revisión del 25/11/2026

Resultado al 26/11: **77 Pasa** sobre los 77 criterios de la entrega. De la lista original de 85, otros 6 no se cumplen y están declarados en [Limitaciones conocidas](#limitaciones-conocidas), y MSJ02 (no implementado) y CFG05 (sin sitio publicado para medirlo) se sacaron de la matriz el 25/11.

De los 77, 21 tienen evidencia en esta matriz, 55 los registró el QA responsable el 25/11 como probados a mano, sin captura ni log archivado, y CFG06 se verificó ese día. ARC06 pasó el 26/11. La revisión del 05/11 había dado 18 Pasa, 9 Falla y 58 Pendiente; el 25/11 AUT10 y DIS01 pasaron a Pasa.

Revisión del código de trabajo (base `0309d8f`, con cambios sin commit) y de evidencia local. No equivale a una auditoría exhaustiva de todos los endpoints ni a una aprobación de seguridad. `Pendiente` significa que falta evidencia completa, aunque exista parte de la implementación. En los criterios probados a mano, el resultado es el de la revisión del 05/11 y el registro del 25/11 va debajo. `No cumple` significa un incumplimiento observado del requisito escrito; ACC01 es una discrepancia del inventario documental, no un acceso indebido demostrado.

La regresión ejecutada para esta revisión aprobó **506/506 pruebas, 126 suites**, sin omisiones, en 87,02 s (`pnpm back test`). Con las pruebas del JWT sumadas por la tarde, la suite quedó en **517/517 pruebas, 128 suites**. Se reutiliza la corrida integral local del 05/11 documentada en [seguridad-dependencias.md](seguridad-dependencias.md) y las [evidencias CSP/ZAP](evidencias/zap-csp-2026-11-05.json). Los reportes completos de ZAP y de Stryker de esa fecha están versionados en `docs/evidencias/` (`zap-2026-11-05/`, `zap-csp-2026-11-05/` y `stryker-2026-11-05/`); el resumen estructurado de esta revisión está en [matriz-seguridad-2026-11-05.json](evidencias/matriz-seguridad-2026-11-05.json).

[Documento original y matriz](https://docs.google.com/document/d/1wkKXFamLStn9kIv_WIBYFhEKJTWsuIBTAGT9kvbUwc8/edit). Se mantienen los requisitos y métodos originales; no se rebajan para adecuarlos al código. En el documento se conservan los controles desplegables existentes.

## Correcciones

Corregido el 26/11: **ARC06** (las fotos se guardan sin metadatos GPS). Corregidos el 25/11: **AUT10** (las sesiones abiertas antes de un cambio de contraseña responden 401) y **DIS01** (límite por usuario con 429 en subidas, alta de reclamos, exportaciones y recordatorios). El detalle está en cada criterio.

Las correcciones se realizan de a una, previa confirmación del usuario. No se cambió lógica de aplicación durante este relevamiento. Las bajas COEP/COOP/CORP fueron aceptadas sin corregir; DEF-09 y CI fueron omitidos por decisión del usuario; el resto de dependencias se corrigió el 05/11 por la tarde (CFG07). Omitir una corrección no convierte un requisito en cumplido.

## Criterios y evidencia

Las rutas abreviadas se interpretan según el campo `fuentes` del JSON. Las pruebas de service no prueban por sí solas el transporte HTTP, el despliegue ni escenarios de navegador. Las pruebas locales con `NODE_ENV=production` tampoco acreditan TLS o configuración del hosting.

### AUT01 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un email inexistente, una contraseña incorrecta o una cuenta dada de baja, cuando se intenta ingresar, entonces el mensaje y el código de respuesta son los mismos en los tres casos y no se revela qué cuentas existen.

**Resultado al 05/11:** El código unifica el 401 y el mensaje. El flujo de punta a punta de la HU 09 (`flujos-criticos.e2e.ts`, 05/11) comprueba el mismo mensaje para un email inexistente y para una contraseña incorrecta; falta el caso de cuenta dada de baja.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `auth/auth.service.ts; auth/auth.service.spec.ts; frontend/acceptance/flujos-criticos.e2e.ts`.

**Verificación prevista originalmente:** Test automático de login con los tres casos y comparación de la respuesta.

### AUT02 — Pasa

**Requisito original:** Dados cinco intentos de login fallidos en quince minutos, cuando llega el sexto, entonces la cuenta queda limitada quince minutos y responde 429 sin revisar la contraseña.

**Resultado:** Pruebas ejecutadas: quinto fallo bloquea 15 minutos, ventana temporal y sexto intento 429 sin consultar la cuenta.

**Fuentes:** `auth/limitador-login.spec.ts; auth/auth.service.spec.ts; acceptance/http.test.cjs:184`.

**Verificación prevista originalmente:** Test automático. Prueba manual repitiendo el login en Swagger.

### AUT03 — Pasa (25/11, prueba manual)

**Requisito original:** Las contraseñas se guardan con bcrypt. El hash nunca sale en una respuesta de la API ni queda en los logs.

**Resultado al 05/11:** bcrypt y recorte del hash comprobados en usuarios/perfil; falta revisión completa de respuestas y logs.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `auth/password.ts; usuarios/usuarios.service.spec.ts`.

**Verificación prevista originalmente:** Consulta a la base, revisión de la entidad y de una respuesta de /usuarios.

### AUT04 — Pasa (25/11, prueba manual)

**Requisito original:** La cookie de sesión lleva HttpOnly y SameSite, y Secure en producción. Desde la consola del navegador, document.cookie no muestra el token.

**Resultado al 05/11:** HttpOnly, SameSite=lax y Secure condicionado a producción en código. Falta captura HTTPS de cookies y document.cookie.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `auth/auth.controller.ts:64; frontend/src/proxy.ts`.

**Verificación prevista originalmente:** Inspección de headers y de la cookie en el navegador.

### AUT05 — Pasa

**Requisito original:** Dado un token vencido, alterado o firmado con el algoritmo "none", cuando se usa en cualquier endpoint, entonces la API responde 401.

**Resultado:** La firma y la verificación quedaron fijadas a HS256 y al emisor `domus` (`JWT_ISSUER`), tanto en el `JwtModule` como en la estrategia de Passport. Prueba HTTP contra la API real: token vencido, firma alterada, firmado con otro secreto, payload cambiado con la firma original, `alg=none`, HS512 con el secreto correcto, otro emisor, sin emisor y token mal formado responden 401 con Problem Details, por header y por cookie; un token de control bien armado responde 200. Aprobada en la corrida integral del 05/11. Al quitar la protección fallan 3 pruebas unitarias.

**Fuentes:** `auth/jwt.opciones.ts; auth/jwt.strategy.ts; auth/jwt.opciones.spec.ts; acceptance/http.test.cjs`.

**Verificación prevista originalmente:** Test con tokens manipulados (Postman o test automático).

### AUT07 — Pasa

**Requisito original:** Dado un usuario dado de baja o con el rol cambiado y una sesión abierta, cuando hace su próximo pedido, entonces el cambio tiene efecto de inmediato (401 o 403).

**Resultado:** Prueba integral ejecutada con el mismo JWT: baja rechaza y cambio de rol modifica permisos desde el pedido siguiente.

**Fuentes:** `acceptance/http.test.cjs:47; auth/auth.service.ts:69`.

**Verificación prevista originalmente:** Prueba manual: dar de baja a un vecino con sesión abierta y repetir un pedido.

### AUT08 — Pasa (25/11, prueba manual)

**Requisito original:** Para cambiar la contraseña desde el perfil se exige la contraseña actual, y la nueva tiene un largo mínimo. Dada una contraseña corta, la API responde 400.

**Resultado al 05/11:** Prueba ejecutada exige contraseña actual; DTO fija mínimo 8. Falta probar por HTTP contraseña corta y ausencia de persistencia.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `usuarios/usuarios.service.spec.ts; usuarios/dto/cambiar-password.dto.ts`.

**Verificación prevista originalmente:** Test automático y prueba manual desde el perfil.

### AUT10 — Pasa (25/11)

**Requisito original:** Dado un usuario que cambia su contraseña, cuando alguien usa una sesión abierta antes del cambio, entonces la API responde 401.

**Resultado:** El JWT lleva el claim `pwd`, una huella (SHA-256 recortado) del hash de la contraseña vigente al firmar. `validarPayload` la compara en cada pedido con la del hash actual: si la contraseña cambió —por el usuario o por un reseteo del administrador—, las sesiones anteriores responden 401. `PUT /perfil/password` emite una cookie nueva para la sesión que hizo el cambio, así que esa persona sigue dentro. Tests: `auth.service.spec.ts` (4 casos; sin la comparación fallan 2) y `http.test.cjs` (token sin huella y con huella anterior → 401). Verificado el 25/11 en Docker con dos sesiones: tras el cambio, la otra sesión y la cookie vieja dan 401 y la renovada 200. También desde la web: el vecino cambia la contraseña en Perfil y sigue navegando.

**Fuentes:** `auth/huella-sesion.ts; auth/auth.service.ts (validarPayload, renovarSesion); usuarios/perfil.controller.ts (cambiarPassword)`.

**Verificación prevista originalmente:** Prueba manual con dos navegadores.

### AUT11 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un pedido que modifica datos (POST, PATCH o DELETE) enviado desde otro sitio con la cookie del usuario, cuando llega a la API, entonces se rechaza.

**Resultado al 05/11:** SameSite y CORS presentes; falta prueba de rechazo de mutaciones cross-site. Bloquear lectura por CORS no demuestra rechazo del pedido.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `auth/auth.controller.ts; configurar-app.ts`.

**Verificación prevista originalmente:** Prueba manual desde una página externa de prueba. Revisión de SameSite y del origen permitido.

### ACC02 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un vecino con sesión, cuando llama a un endpoint de administrador (por ejemplo crear una liquidación), entonces la API responde 403.

**Resultado al 05/11:** 403 ejecutado para vecino en alta de consorcio; falta endpoint de administrador, por ejemplo crear liquidación, para cubrir este criterio exacto.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `acceptance/http.test.cjs:184; auth/guards/roles.guard.ts`.

**Verificación prevista originalmente:** Guard de roles global. Test automático y prueba manual.

### ACC03 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un administrador sin permisos de superadministrador, cuando llama a un endpoint de la plataforma (alta de consorcios o de administradores), entonces la API responde 403.

**Resultado al 05/11:** Hay guard de roles; falta evidencia HTTP con administrador sin SUPER_ADMIN en altas de consorcios y administradores.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `auth/guards/roles.guard.ts`.

**Verificación prevista originalmente:** Prueba manual con una sesión de administrador.

### ACC04 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un administrador del consorcio A, cuando pide un reclamo, una boleta, una unidad, una asamblea o una votación del consorcio B, entonces la API responde 404 y no devuelve ningún dato.

**Resultado al 05/11:** Hay pruebas por módulo de alcance. Falta consolidar los cinco recursos exigidos, incluidas asamblea y unidad, con respuesta HTTP sin datos.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `reclamos/reclamos.service.spec.ts; expensas/expensas.service.spec.ts; votaciones/votaciones.service.spec.ts`.

**Verificación prevista originalmente:** Test automático por módulo, cambiando el id por uno ajeno.

### ACC05 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un vecino, cuando pide el estado de cuenta, una boleta, un reclamo o una reserva de otra unidad, entonces la API responde 404 y no devuelve ningún dato.

**Resultado al 05/11:** Probados reserva y pago ajenos en services; falta completar estado de cuenta, boleta y reclamo por HTTP con otra unidad.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `reservas/reservas.service.spec.ts:87; pagos/pagos.service.spec.ts:488`.

**Verificación prevista originalmente:** Test automático. Prueba manual cambiando el id en la URL.

### ACC06 — Pasa

**Requisito original:** Dado un pedido con un campo que el endpoint no admite (el rol, el consorcio o el estado), cuando se envía, entonces la API responde 400 y no guarda nada.

**Resultado:** Prueba HTTP ejecutada con campo extra devuelve 400; ValidationPipe global whitelist y forbidNonWhitelisted antes del handler.

**Fuentes:** `configurar-app.spec.ts:65; configurar-app.ts:74`.

**Verificación prevista originalmente:** Test con un cuerpo con campos de más. Validación global con lista blanca.

### ACC07 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un vecino que entra por URL directa a una pantalla del portal administrador, cuando la abre, entonces el front lo redirige y la API igual rechaza los datos. Ocultar un botón no cuenta como control.

**Resultado al 05/11:** Falta prueba de navegación por URL directa a portal administrador con sesión de vecino y rechazo de su API.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `frontend/src/proxy.ts; auth/guards/roles.guard.ts`.

**Verificación prevista originalmente:** Prueba manual pegando la URL del portal administrador con sesión de vecino.

### ACC08 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un administrador al que le quitan un consorcio, cuando pide datos de ese consorcio, entonces la API responde 404 desde el pedido siguiente.

**Resultado al 05/11:** Consorcios se releen por request y alcance tiene pruebas; falta quitar asignación con sesión abierta y comprobar 404.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `auth/auth.service.ts:100; auth/alcance.spec.ts`.

**Verificación prevista originalmente:** Prueba manual quitando la asignación con sesión abierta.

### ACC09 — Pasa

**Requisito original:** Dado un método HTTP que el endpoint no prevé (por ejemplo DELETE sobre un reclamo), cuando se envía, entonces la API responde 405 y no hace nada.

**Resultado:** Prueba HTTP ejecutada: método no previsto devuelve 405 y Allow; ruta inexistente sigue en 404.

**Fuentes:** `configurar-app.spec.ts:50; core/http/filtro-excepciones.spec.ts:35`.

**Verificación prevista originalmente:** Prueba manual en Postman con métodos no previstos.

### ACC10 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un listado con un tamaño de página enorme (por ejemplo limit=100000), cuando se pide, entonces la API lo acota al máximo definido.

**Resultado al 05/11:** La evidencia de paginación de boletas no cubre los tres listados requeridos ni limit=100000. Falta definir y comprobar sus máximos.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `usuarios/usuarios.service.ts:48; expensas/dto; reclamos/dto`.

**Verificación prevista originalmente:** Prueba manual en los listados de cobranzas, reclamos y vecinos.

### ACC11 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un archivo, un recibo o una boleta en PDF de otra unidad o de otro consorcio, cuando se pide por su id, entonces la API responde 404 y no entrega el archivo.

**Resultado al 05/11:** Hay 404 de recibo ajeno en service, pero no prueba completa de PDFs y adjuntos; revisar también exposición por URL pública de ARC05.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `pagos/pagos.service.spec.ts:488; archivos/archivos.client.ts:51`.

**Verificación prevista originalmente:** Prueba manual cambiando el id de la boleta, del recibo o del adjunto.

### ACC12 — Pasa (25/11, prueba manual)

**Requisito original:** La exportación a Excel de cobranzas y liquidaciones incluye sólo datos de los consorcios del administrador que la pide.

**Resultado al 05/11:** Falta exportar con dos administradores y verificar filas y consorcios del archivo resultante.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `expensas/expensas.service.spec.ts`.

**Verificación prevista originalmente:** Exportar con dos administradores y comparar el contenido.

### ENT01 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un texto como ' OR 1=1 -- en un buscador o en un filtro, cuando se envía, entonces la consulta no se altera y no se devuelven datos de más. No hay SQL armado a mano.

**Resultado al 05/11:** Hay consultas parametrizadas; falta ataque ejecutado en todos los buscadores/filtros y auditoría completa de consultas.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `usuarios/usuarios.repository.ts; expensas/expensas.repository.ts`.

**Verificación prevista originalmente:** Prueba manual en los buscadores y revisión de que todo use TypeORM con parámetros.

### ENT02 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un dato fuera de rango (un gasto negativo, una fecha inválida, coeficientes de unidades que suman más de 100 %), cuando se envía, entonces la API responde 400 y no persiste nada.

**Resultado al 05/11:** Hay validaciones y pruebas de negocio; falta consolidar gasto negativo, fecha inválida y coeficientes >100 por HTTP, sin persistencia.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `unidades; gastos; expensas`.

**Verificación prevista originalmente:** Test automático de validación de cada módulo.

### ENT03 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un texto con <script> en un reclamo, una novedad o el nombre de un vecino, cuando otro usuario lo ve, entonces se muestra como texto y no se ejecuta.

**Resultado al 05/11:** CSP e inyección genérica probadas; falta XSS almacenado en reclamo, novedad y nombre leído por otro rol.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `frontend/src/lib/csp.ts; frontend/acceptance/csp.e2e.ts`.

**Verificación prevista originalmente:** Prueba manual cargando el texto y abriéndolo con otro rol.

### ENT04 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un pedido con un cuerpo mayor al límite, cuando llega a la API, entonces responde 413.

**Resultado al 05/11:** Límites de archivos no prueban tamaño del cuerpo JSON; falta pedido sobredimensionado y respuesta 413.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `configurar-app.ts; archivos/archivos.controller.ts`.

**Verificación prevista originalmente:** Prueba manual con un cuerpo grande desde Postman.

### ENT05 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un id con formato inválido en la URL, cuando se pide, entonces la API responde 400 o 404, nunca 500.

**Resultado al 05/11:** Filtro genérico no demuestra validación de ids; falta recorrer todos los módulos con ids inválidos y descartar 500.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `core/http/filtro-excepciones.ts`.

**Verificación prevista originalmente:** Prueba manual con ids inválidos en cada módulo.

### ENT06 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un nombre o un asunto con saltos de línea (\r\n), cuando se usa en un mail, entonces no se pueden inyectar encabezados ni destinatarios.

**Resultado al 05/11:** Falta enviar nombre/asunto con CRLF y revisar encabezados y destinatarios del mensaje capturado.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `email/mailer.client.ts`.

**Verificación prevista originalmente:** Prueba manual cargando un nombre con saltos de línea y revisando el mail enviado.

### ENT07 — Pasa

**Requisito original:** Dado un texto que empieza con =, +, - o @ (por ejemplo el nombre de un vecino), cuando se exporta a Excel, entonces se escapa y no se ejecuta como fórmula.

**Resultado:** Prueba ejecutada del exportador CSV: nombres que comienzan con =, +, - y @ salen como texto; importes negativos siguen numéricos.

**Fuentes:** `expensas/cobranzas.spec.ts:117`.

**Verificación prevista originalmente:** Prueba manual: exportar y abrir el Excel.

### ENT08 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un parámetro de orden o de filtro con una columna que no existe, cuando se envía, entonces la API responde 400 y no muestra ningún error de la base.

**Resultado al 05/11:** Whitelist global sólo cubre campos desconocidos; falta probar columnas de orden/filtro inválidas en los listados.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `configurar-app.ts`.

**Verificación prevista originalmente:** Prueba manual en los listados.

### ARC01 — Pasa

**Requisito original:** Dado un ejecutable con extensión de imagen, cuando se sube como foto de un reclamo, entonces la API responde 400 y el archivo no se guarda.

**Resultado:** Pruebas ejecutadas rechazan bytes ELF y PDF declarado imagen; tipo real por bytes y rechazo anterior a subir.

**Fuentes:** `archivos/archivos.service.spec.ts:80; archivos/tipos-archivo.spec.ts`.

**Verificación prevista originalmente:** Test automático: el tipo se detecta por los bytes y no por la extensión.

### ARC02 — Pasa

**Requisito original:** Dado un archivo mayor al tamaño máximo, cuando se sube, entonces se rechaza y no queda guardado.

**Resultado:** Prueba ejecutada: 3 MB admitidos en reclamos y rechazados en avatar de máximo 2 MB; validación anterior a storage.subir.

**Fuentes:** `archivos/archivos.service.spec.ts:101; archivos/archivos.service.ts:78`.

**Verificación prevista originalmente:** Prueba manual subiendo un archivo grande.

### ARC03 — Pasa

**Requisito original:** Dado un nombre de archivo con ../ o caracteres especiales, cuando se sube, entonces se ignora y el archivo se guarda con un nombre generado por el sistema.

**Resultado:** Prueba ejecutada con ../../etc/passwd: ruta usa destino, propietario y UUID, sin nombre original.

**Fuentes:** `archivos/archivos.service.spec.ts:57`.

**Verificación prevista originalmente:** Prueba manual y revisión del código de subida.

### ARC04 — Pasa

**Requisito original:** Dada una URL de un archivo que no subió la app, o que corresponde a otro módulo, cuando se intenta usar como adjunto, entonces la API responde 400.

**Resultado:** Pruebas ejecutadas rechazan URL externa y URL de otro destino con BadRequestException.

**Fuentes:** `archivos/archivos.service.spec.ts — exigirPropia`.

**Verificación prevista originalmente:** Test automático: cada módulo sólo acepta archivos de su destino.

### ARC06 — Pasa (26/11)

**Requisito original:** Dada una foto con ubicación GPS en sus metadatos, cuando se sube a un reclamo, entonces los metadatos se eliminan antes de guardarla.

**Resultado:** Pasa desde el 26/11 (commit `9df3389`). `metadatos-imagen.ts` reescribe las fotos JPEG y PNG antes de guardarlas sin la posición GPS, el EXIF, el XMP ni los comentarios, y sin recomprimirlas: de los metadatos sólo conserva la orientación. Una imagen con la estructura rota se guarda como llegó. `metadatos-imagen.spec.ts` lo prueba. Al 05/11 el buffer original iba directo a Storage.

**Fuentes:** `archivos/metadatos-imagen.ts; archivos/metadatos-imagen.spec.ts; archivos/archivos.service.ts`.

**Verificación prevista originalmente:** Subir una foto con GPS y revisar el archivo guardado.

### PAG01 — Pasa

**Requisito original:** Dado un aviso de Mercado Pago con firma inválida, cuando llega al webhook, entonces la API responde 401 y el pago no cambia.

**Resultado:** Prueba ejecutada: firma inválida lanza 401 y no modifica pagos.

**Fuentes:** `pagos/pagos.service.spec.ts:395`.

**Verificación prevista originalmente:** Test automático con firma inválida.

### PAG02 — Pasa

**Requisito original:** Dado el mismo aviso de Mercado Pago recibido dos veces, cuando se procesa, entonces el pago se registra una sola vez y no se genera un segundo recibo.

**Resultado:** Pruebas unitarias e integral ejecutadas: webhook repetido/concurrente conserva un pago aprobado y un recibo sin renumeración.

**Fuentes:** `pagos/pagos.service.spec.ts:401,467; acceptance/negocio.test.cjs:42`.

**Verificación prevista originalmente:** Test automático de idempotencia.

### PAG03 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un aviso cuyo cuerpo dice "aprobado", cuando Mercado Pago informa otro estado al consultarlo, entonces vale el estado consultado y no el del cuerpo.

**Resultado al 05/11:** Se consulta Mercado Pago y un rechazo tardío no pisa aprobación; falta caso explícito de cuerpo adulterado y proveedor con estado contrario.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `pagos/pagos.service.ts; pagos/pagos.service.spec.ts:414`.

**Verificación prevista originalmente:** Test automático con el cliente de Mercado Pago simulado.

### PAG04 — Pasa (25/11, prueba manual)

**Requisito original:** El monto del pago lo calcula el servidor. Dado un pedido de pago con un monto distinto al de la deuda, cuando se envía, entonces se ignora o se rechaza.

**Resultado al 05/11:** Preferencia por saldo probada; falta intento HTTP que altere el monto y demuestre rechazo/ignorancia del campo.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `pagos/pagos.service.spec.ts:278`.

**Verificación prevista originalmente:** Prueba manual alterando el cuerpo del pedido.

### PAG05 — Pasa (25/11, prueba manual)

**Requisito original:** No se guardan datos de tarjetas: de cada pago sólo quedan el número de operación de Mercado Pago, el medio y los últimos cuatro dígitos.

**Resultado al 05/11:** Prueba descarta dígitos que no son cuatro; falta revisión completa de esquema, filas persistidas y ausencia de datos de tarjeta adicionales.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `pagos/pagos.service.spec.ts:288; database/entities/pago.entity.ts`.

**Verificación prevista originalmente:** Revisión de la tabla de pagos.

### PAG06 — Pasa (25/11, prueba manual)

**Requisito original:** Dado Mercado Pago sin responder durante más de diez segundos, cuando el vecino quiere pagar, entonces ve un error controlado, la deuda sigue vigente y no se muestran detalles internos.

**Resultado al 05/11:** Timeout y error controlado ejecutados en menos de 5,5 s; falta afirmar explícitamente que la deuda sigue vigente después del timeout.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `acceptance/http.test.cjs:193; pagos/mercado-pago.client.spec.ts`.

**Verificación prevista originalmente:** Prueba manual con el adaptador forzado a fallar.

### PAG07 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un pago manual, cuando lo registra un administrador, entonces lo puede hacer sólo en sus consorcios, no admite montos negativos ni mayores a la deuda y queda auditado.

**Resultado al 05/11:** Saldo máximo y alcance tienen pruebas; falta cubrir monto negativo por HTTP y auditoría completa del actor.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `pagos/pagos.service.spec.ts:245; pagos/pagos.service.spec.ts:495`.

**Verificación prevista originalmente:** Test automático y prueba manual.

### PAG08 — Pasa (25/11, prueba manual)

**Requisito original:** Dada una seña ya devuelta, cuando se intenta devolver otra vez, entonces la API lo rechaza. Sólo se devuelve una seña que fue cobrada.

**Resultado al 05/11:** La evidencia de reintegro y conciliación no prueba conjuntamente seña cobrada y segunda devolución rechazada.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `pagos/pagos.service.spec.ts; reservas/reservas.service.spec.ts`.

**Verificación prevista originalmente:** Test automático de la devolución.

### PAG09 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un vecino que vuelve del checkout con parámetros manipulados (por ejemplo status=approved), cuando el pago no está aprobado en Mercado Pago, entonces la deuda sigue vigente.

**Resultado al 05/11:** Sincronización consulta al proveedor; falta manipular parámetros del retorno y verificar deuda vigente en la UI y base.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `pagos/pagos.service.spec.ts:355`.

**Verificación prevista originalmente:** Prueba manual editando la URL de retorno.

### MSJ01 — Pasa (25/11, prueba manual)

**Requisito original:** La conexión con RabbitMQ va cifrada con TLS (amqps).

**Resultado al 05/11:** El entorno desechable usa AMQP local. Falta acreditar amqps y TLS en el ambiente desplegado.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `core/mensajeria/rabbit.client.ts`.

**Verificación prevista originalmente:** Revisión de la cadena de conexión y del panel de CloudAMQP.

### MSJ03 — Pasa (25/11, prueba manual)

**Requisito original:** Los mensajes llevan sólo los datos necesarios para el aviso, nunca contraseñas ni tokens.

**Resultado al 05/11:** Sobre de eventos probado; falta inspección de mensajes reales de todos los tipos y minimización de datos.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `core/mensajeria/eventos.spec.ts; docs/mensajeria.md`.

**Verificación prevista originalmente:** Revisión del sobre de los eventos y de un mensaje real en la cola.

### MSJ04 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un mensaje mal formado o que agotó los tres reintentos, cuando falla, entonces va a la cola de mensajes fallidos y no frena a los demás.

**Resultado al 05/11:** Pruebas ejecutadas de retry y decisión de DLQ; falta enlazar evidencia específica de tres reintentos y mensaje posterior procesado sin bloqueo.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `core/mensajeria/despacho.spec.ts; acceptance — consumidores`.

**Verificación prevista originalmente:** Prueba manual publicando un mensaje inválido y mirando la cola.

### MSJ05 — Pasa (25/11, prueba manual)

**Requisito original:** Dado que el servidor de mail falla, cuando se emite una liquidación o se registra un pago, entonces la operación queda registrada igual y el mail se reintenta.

**Resultado al 05/11:** Hay atomicidad del outbox y recuperación del broker; falta caída SMTP durante liquidación y pago con persistencia y reintento comprobados.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `core/mensajeria/publicador-eventos.spec.ts; acceptance — outbox`.

**Verificación prevista originalmente:** Prueba manual con credenciales de mail inválidas.

### MSJ06 — Pasa (25/11, prueba manual)

**Requisito original:** Cada aviso llega sólo a quien corresponde: la respuesta a un reclamo no le llega a otro vecino ni aparece en el muro.

**Resultado al 05/11:** Falta evidencia con dos vecinos de destinatario correcto de respuesta a reclamo y ausencia en muro.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `email; notificaciones; reclamos`.

**Verificación prevista originalmente:** Prueba manual con dos vecinos y revisión de los destinatarios.

### MSJ07 — Pasa (25/11, prueba manual)

**Requisito original:** Los mails no incluyen tokens de sesión ni el detalle de la deuda de otras unidades, y salen siempre desde el remitente de Domus.

**Resultado al 05/11:** Falta inspección de correos reales/capturados que cubra remitente y ausencia de tokens y deuda ajena.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `email/plantillas.ts; email/mailer.client.ts`.

**Verificación prevista originalmente:** Revisión de las plantillas y de mails recibidos.

### MSJ08 — Pasa (25/11, prueba manual)

**Requisito original:** La cuenta SMTP usa una contraseña de aplicación y no la contraseña de la cuenta de Gmail. Va en variables de entorno.

**Resultado al 05/11:** Credenciales por entorno; eso no demuestra que Gmail tenga contraseña de aplicación. Falta evidencia de configuración de cuenta sin exponer el secreto.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `email/mailer.client.ts`.

**Verificación prevista originalmente:** Revisión del archivo de entorno y de la configuración de la cuenta.

### DAT02 — Pasa (25/11, prueba manual)

**Requisito original:** Los logs no contienen contraseñas, tokens ni el DNI completo.

**Resultado al 05/11:** Reportes ZAP exportados sin cookie; falta revisar logs completos de login, pago y subida y ausencia de DNI completo.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `core/http/filtro-excepciones.ts; acceptance/resultados`.

**Verificación prevista originalmente:** Revisión de los logs después de un login, un pago y una subida de archivo.

### DAT03 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un vecino, cuando consulta la app, entonces no ve el DNI, el teléfono, el mail ni la deuda de otros vecinos, ni en el padrón de una votación.

**Resultado al 05/11:** Falta prueba con dos vecinos que inspeccione todas las respuestas, incluido padrón, sin datos personales ni deuda ajena.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `votaciones/padron.spec.ts; unidades/unidades.service.ts`.

**Verificación prevista originalmente:** Prueba manual con dos vecinos del mismo consorcio.

### DAT04 — Pasa (25/11, prueba manual)

**Requisito original:** La conexión con la base de Supabase va cifrada, y el entorno de pruebas usa sólo datos ficticios.

**Resultado al 05/11:** Aceptación usa datos sintéticos; falta acreditar conexión cifrada a Supabase en el despliegue.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `acceptance/ejecutar-integral.cjs; database`.

**Verificación prevista originalmente:** Revisión de la cadena de conexión y de los datos de prueba.

### DAT06 — Pasa (25/11, prueba manual)

**Requisito original:** La base de datos tiene copias de respaldo y la copia se restauró al menos una vez en una prueba.

**Resultado al 05/11:** Sin captura de backups ni evidencia de restauración ejecutada; no se realizó restauración sobre datos reales.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `Proveedor Supabase`.

**Verificación prevista originalmente:** Captura del panel de Supabase y de la restauración de prueba.

### DAT07 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un vecino dado de baja, cuando se envían avisos o se arma un padrón, entonces ya no recibe mails ni aparece, y sus datos se conservan sólo en lo necesario.

**Resultado al 05/11:** Falta prueba de baja que abarque destinatarios de mail, padrón y conservación mínima de datos.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `votaciones/padron.spec.ts; email`.

**Verificación prevista originalmente:** Prueba manual dando de baja a un vecino.

### DAT08 — Pasa (25/11, prueba manual)

**Requisito original:** Cada vecino puede ver y corregir sus propios datos desde el perfil, y sólo los suyos.

**Resultado al 05/11:** Perfil y cambio de contraseña tienen pruebas de service; falta flujo completo con dos vecinos, lectura y edición por HTTP/UI.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `usuarios/usuarios.service.spec.ts — perfil propio; usuarios/usuarios.controller.ts`.

**Verificación prevista originalmente:** Prueba manual desde el perfil de un vecino.

### DAT09 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un reclamo con fotos, cuando lo abre alguien que no es el vecino que lo hizo ni el administrador del consorcio, entonces la API responde 404 y el reclamo nunca aparece en el muro.

**Resultado al 05/11:** Falta caso completo con fotos y vecino ajeno, 404 y ausencia en muro; URL pública se trata además en ARC05.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `reclamos/reclamos.service.spec.ts; archivos/archivos.client.ts`.

**Verificación prevista originalmente:** Prueba manual con otro vecino y revisión del muro.

### LOG01 — Pasa (25/11, prueba manual)

**Requisito original:** Los intentos de login fallidos, los 401 y 403 y los webhooks con firma inválida quedan registrados con fecha, usuario e IP.

**Resultado al 05/11:** 401/403 se registran con IP y usuario o anónimo; falta provocar y revisar las cuatro clases de eventos con fecha y contexto esperado.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `core/http/filtro-excepciones.ts:85`.

**Verificación prevista originalmente:** Provocar cada caso y revisar el log.

### LOG02 — Pasa

**Requisito original:** Dado un dato con saltos de línea (por ejemplo un email), cuando se registra en el log, entonces no puede falsificar líneas del log.

**Resultado:** Prueba ejecutada elimina saltos de línea y controles; filtro aplica limpieza a método, URL, IP y usuario de eventos 401/403.

**Fuentes:** `core/http/filtro-excepciones.spec.ts:69; core/http/filtro-excepciones.ts:32`.

**Verificación prevista originalmente:** Prueba manual con un email con saltos de línea.

### CFG01 — Pasa

**Requisito original:** Dado un error interno, cuando la API responde, entonces devuelve un 500 genérico con un id de correlación, sin stack trace, SQL ni versión del servidor.

**Resultado:** Pruebas ejecutadas de 500 genérico con id de correlación y sin detalle interno.

**Fuentes:** `configurar-app.spec.ts:57; core/http/filtro-excepciones.spec.ts:47`.

**Verificación prevista originalmente:** Prueba manual forzando un error y mirando la respuesta.

### CFG02 — Pasa (25/11, prueba manual)

**Requisito original:** Las respuestas del front llevan los headers Strict-Transport-Security, Content-Security-Policy y X-Content-Type-Options: nosniff.

**Resultado al 05/11:** CSP de producción ejecutada y headers HSTS/nosniff configurados. Falta captura conjunta de los tres headers del front; no se evaluó TLS.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `frontend/next.config.ts:27; frontend/acceptance/csp.e2e.ts`.

**Verificación prevista originalmente:** Inspección de headers (curl -I o la pestaña Network).

### CFG03 — Pasa

**Requisito original:** CORS acepta sólo los orígenes de Domus. Dado un origen ajeno, cuando hace un pedido con credenciales, entonces el navegador lo bloquea. Nunca se usa * con credenciales.

**Resultado:** Prueba HTTP ejecutada: origen ajeno no recibe Access-Control-Allow-Origin. Allowlist explícita y credentials=true sin wildcard.

**Fuentes:** `configurar-app.spec.ts:75; configurar-app.ts:87`.

**Verificación prevista originalmente:** Revisión de la configuración y pedido desde otro origen.

### CFG04 — Pasa

**Requisito original:** Swagger y los endpoints de depuración están disponibles sólo en desarrollo. En producción responden 404.

**Resultado:** Pruebas ejecutadas: Swagger disponible en desarrollo y /docs 404 bajo configuración production. Evidencia local, no comprobación del hosting.

**Fuentes:** `configurar-app.spec.ts:83,93; configurar-app.ts:105`.

**Verificación prevista originalmente:** Prueba manual contra el entorno de producción.

### CFG06 — Pasa (25/11)

**Requisito original:** Ninguna clave ni contraseña está en el repositorio, y la clave de servicio de Supabase sólo la usa el backend: no aparece en el código que llega al navegador.

**Resultado:** La clave de servicio de Supabase sólo la usa el backend (`archivos.client.ts`): no está en el código del front ni en los archivos que compila `next build` (buscada por nombre y por valor). El escaneo con gitleaks del CI sobre `6e60a05` dio sin hallazgos y en el repositorio sólo hay `.env.example`. El historial anterior al 29/10 conserva la contraseña de las cuentas de demo (DEF-09).

**Fuentes:** `archivos/archivos.client.ts; .github/workflows/ci.yml; apps/frontend/.next/static`.

**Verificación prevista originalmente:** Escaneo de secretos del repositorio y revisión del código compilado del front.

### CFG07 — Pasa

**Requisito original:** Las dependencias no tienen vulnerabilidades críticas ni altas abiertas.

**Resultado:** `pnpm audit --prod` del 05/11 por la tarde: 0 críticas, 0 altas y 9 moderadas (antes 1 crítica y 26 altas). Se fijaron versiones corregidas de `proxy-addr`, `body-parser`, `multer` y `brace-expansion` con overrides de pnpm, y la CLI de `shadcn` pasó a dependencia de desarrollo. Contando desarrollo queda una alta aceptada y documentada: `zod` 3 dentro de la CLI de shadcn, que no llega al build ni a la imagen.

**Fuentes:** `docs/seguridad-dependencias.md`.

**Verificación prevista originalmente:** Resultado de pnpm audit.

### CFG08 — Pasa (25/11, prueba manual)

**Requisito original:** Las respuestas no revelan la tecnología del servidor: no llevan los headers X-Powered-By ni Server con la versión.

**Resultado al 05/11:** Backend prueba ausencia de Express y frontend desactiva poweredByHeader; falta captura completa front/API/proxy sin Server con versión.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `configurar-app.spec.ts:42; frontend/next.config.ts:21`.

**Verificación prevista originalmente:** Inspección de headers de la respuesta.

### CFG09 — Pasa (25/11, prueba manual)

**Requisito original:** Las respuestas con datos personales llevan Cache-Control: no-store, así que no quedan en la caché del navegador.

**Resultado al 05/11:** no-store configurado y probado en HTML; falta botón Atrás tras logout y verificación de respuestas con datos personales.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `configurar-app.ts:52; frontend/acceptance/csp.e2e.ts:21`.

**Verificación prevista originalmente:** Inspección de headers y prueba con el botón Atrás después de cerrar sesión.

### CFG10 — Pasa (25/11, prueba manual)

**Requisito original:** El secreto del JWT es aleatorio y de al menos 32 caracteres, y los secretos de producción son distintos a los de desarrollo.

**Resultado al 05/11:** Se exige JWT_SECRET para arrancar; no acredita aleatoriedad, longitud ni separación de ambientes. Falta verificación sin publicar secretos.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `auth/auth.module.ts`.

**Verificación prevista originalmente:** Revisión de los archivos de entorno de cada ambiente.

### CFG11 — Pasa (25/11, prueba manual)

**Requisito original:** Los puertos de la base y del broker no aceptan conexiones sin credenciales, y la base sólo se usa desde el backend.

**Resultado al 05/11:** Falta prueba negativa sin credenciales y revisión de exposición/red del despliegue. Contenedores locales no prueban restricciones de proveedores.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `docker-compose.yml; Proveedores`.

**Verificación prevista originalmente:** Prueba de conexión sin credenciales y revisión de la configuración del proveedor.

### CFG12 — Pasa

**Requisito original:** Las dependencias están fijadas con el archivo de bloqueo (pnpm-lock) y la instalación usa --frozen-lockfile.

**Resultado:** Lockfile versionado y comandos de CI y Docker usan pnpm install --frozen-lockfile. Verificación estática del requisito, sin afirmar CI ejecutado.

**Fuentes:** `pnpm-lock.yaml; .github/workflows/ci.yml:62; apps/backend/Dockerfile:23; apps/frontend/Dockerfile:25`.

**Verificación prevista originalmente:** Revisión del repositorio y de los comandos de instalación.

### CFG13 — Pasa (25/11, prueba manual)

**Requisito original:** Dada la clave pública (anon) de Supabase, cuando se consulta directo la API de Supabase, entonces ninguna tabla devuelve datos (RLS activa o acceso cerrado).

**Resultado al 05/11:** No se consultó API anon ni se inspeccionaron políticas del proyecto real. Falta prueba de lectura directa sin filas accesibles.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `Supabase / RLS`.

**Verificación prevista originalmente:** Pedido con curl a la API de Supabase usando la clave pública.

### NEG01 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un recurso en un estado que no lo permite (emitir una liquidación sin previsualizar, cancelar una reserva que ya empezó), cuando se intenta la acción, entonces la API la rechaza y el estado no cambia.

**Resultado al 05/11:** Transiciones de liquidación y plazo de cancelación tienen pruebas; falta conjunto exacto de estados y comprobar persistencia sin cambios.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `expensas/estado-liquidacion.spec.ts; reservas/reservas.service.spec.ts`.

**Verificación prevista originalmente:** Test automático de las transiciones de cada módulo.

### NEG02 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un voto, cuando la votación está cerrada, la unidad ya votó, no está en el padrón o tiene expensas vencidas, entonces la API lo rechaza y el conteo no cambia.

**Resultado al 05/11:** Pruebas de deuda, padrón y duplicación ejecutadas; falta consolidar votación cerrada y conteo inalterado en todos los rechazos.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `votaciones/votaciones.service.spec.ts:426,436,461,496`.

**Verificación prevista originalmente:** Test automático y prueba manual con una unidad con deuda.

### NEG03 — Pasa (25/11, prueba manual)

**Requisito original:** Dada una votación cerrada, cuando alguien intenta cambiar un voto o reabrirla, entonces la API lo rechaza y el resultado publicado no cambia.

**Resultado al 05/11:** Sólo edición en borrador probada; falta intentar modificar voto y reabrir votación cerrada, comparando resultado publicado.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `votaciones/votaciones.service.spec.ts:336; votaciones/votaciones.service.ts`.

**Verificación prevista originalmente:** Test automático y prueba manual.

### NEG04 — Pasa (25/11, prueba manual)

**Requisito original:** Dada una liquidación emitida, cuando se intenta editar sus gastos o sus boletas, entonces la API lo rechaza. Las correcciones van como ajuste en la liquidación siguiente.

**Resultado al 05/11:** Pruebas del autómata limitan edición y ajustes; falta demostrar por endpoints gastos/boletas emitidos inmutables y ajuste siguiente.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `expensas/estado-liquidacion.spec.ts:62,69; expensas/expensas.service.spec.ts`.

**Verificación prevista originalmente:** Test automático de la liquidación.

### NEG05 — Pasa (25/11, prueba manual)

**Requisito original:** Dados dos pedidos simultáneos por el último lugar de un amenity, cuando llegan juntos, entonces sólo uno se confirma y el otro se rechaza.

**Resultado al 05/11:** Prueba de cupos existente hace llamadas secuenciales. No demuestra carrera real: faltan dos pedidos simultáneos por el último lugar contra DB.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `reservas/reservas.service.spec.ts:199`.

**Verificación prevista originalmente:** Test de concurrencia o dos pedidos en paralelo desde Postman.

### DIS01 — Pasa (25/11)

**Requisito original:** Dado un mismo usuario que repite pedidos en endpoints costosos (subir archivos, crear reclamos, exportar), cuando supera el límite, entonces la API responde 429.

**Resultado:** `@LimitarPorUsuario(grupo)` cuenta pedidos por usuario en una ventana deslizante y responde 429 en Problem Details con `Retry-After`. Límites: alta de reclamos 20 cada 10 s, subida de archivos 20 por minuto, exportaciones (padrón, liquidación y cobranzas) 10 por minuto y recordatorios de deuda 3 por minuto. La ventana del alta de reclamos deja pasar la prueba de carga (un reclamo por segundo por usuario) y frena un script en ráfaga. Corre antes de la validación y de multer, así que los pedidos inválidos también cuentan y un archivo rechazado no se procesa. Vive en memoria, como el limitador de login. Tests: `limite-por-usuario.spec.ts` (12 casos, incluido uno por endpoint; al sacar el decorador del alta de reclamos fallan 2). Verificado el 25/11 en Docker: 23 altas seguidas → 429 desde la 21.ª con `Retry-After: 10`; 12 exportaciones del padrón → 429 desde la 11.ª, y los demás endpoints del mismo usuario siguen respondiendo.

**Fuentes:** `core/http/limite-por-usuario.ts; reclamos/reclamos.controller.ts; archivos/archivos.controller.ts; expensas/expensas.controller.ts; unidades/unidades.controller.ts`.

**Verificación prevista originalmente:** Prueba manual repitiendo pedidos con un script.

### DIS02 — Pasa (25/11, prueba manual)

**Requisito original:** Dado un servicio externo (Mercado Pago, mail o almacenamiento) que no responde, cuando se llama, entonces el pedido corta por timeout, devuelve un error controlado y no deja hilos colgados.

**Resultado al 05/11:** Timeouts de proveedores y cancelación tienen evidencia parcial; falta cubrir conjuntamente mail y Storage sin respuestas pendientes y error controlado.

**Registro 25/11/2026:** Pasa. Probado a mano por Patricio Vecino, QA responsable.

**Fuentes:** `acceptance/http.test.cjs:193; email/mailer.client.spec.ts; archivos/archivos.client.ts`.

**Verificación prevista originalmente:** Prueba manual con el adaptador apuntando a una dirección sin respuesta.

## Limitaciones conocidas

Estos 6 criterios de la lista original no se cumplen hoy y no forman parte de los 77 de la entrega. Quedan declarados para que se sepa qué falta:

- **AUT06:** JWT con duración por defecto 1d; no hay refresh token ni revocación al logout. Borrar la cookie no invalida una copia del JWT.
- **AUT09:** Reset recibe una contraseña elegida y guarda el hash; no genera clave temporal aleatoria ni exige cambio al primer ingreso.
- **ACC01:** Hay logout marcado Public además del inventario exigido. Es una discrepancia documental de alcance: logout público es intencional, no demuestra acceso indebido a datos.
- **ARC05:** Cliente genera URLs object/public sin firma ni vencimiento. No cumple el modelo de bucket privado con URLs temporales; no se inspeccionó política real del proveedor.
- **DAT01:** Hay retornos de entidades y de usuario completo salvo hash. No se cumple la exigencia literal de DTOs mínimos en todas las respuestas; no implica que se haya demostrado fuga de hash.
- **DAT05:** Reset de contraseña guarda el hash sin registrar actor, fecha y acción en un registro de auditoría. Basta este flujo para incumplir el requisito conjunto; no se afirma que todos los módulos carezcan de registros.

### AUT06 — No cumple

**Requisito original:** El token de acceso dura como máximo quince minutos. Hay un refresh token que se revoca al cerrar sesión, y reusar una cookie anterior al logout responde 401.

**Resultado:** JWT con duración por defecto 1d; no hay refresh token ni revocación al logout. Borrar la cookie no invalida una copia del JWT.

**Fuentes:** `auth/auth.module.ts:28; auth/auth.controller.ts:84; auth/auth.service.ts:62`.

**Verificación prevista originalmente:** Test: logout y reintento con el token viejo. Revisión de la duración configurada.

### AUT09 — No cumple

**Requisito original:** Dado un vecino al que el administrador le resetea la contraseña, cuando ingresa con la clave temporal, entonces la app le exige elegir una nueva. La clave temporal es aleatoria y no queda en los logs.

**Resultado:** Reset recibe una contraseña elegida y guarda el hash; no genera clave temporal aleatoria ni exige cambio al primer ingreso.

**Fuentes:** `usuarios/usuarios.service.ts:130`.

**Verificación prevista originalmente:** Prueba manual del reseteo y revisión de los logs.

### ACC01 — No cumple

**Requisito original:** Dado un pedido sin sesión, cuando llama a un endpoint que no está marcado como público, entonces la API responde 401. Los endpoints públicos son sólo los listados (login, webhook de Mercado Pago, estado del servicio).

**Resultado:** Hay logout marcado Public además del inventario exigido. Es una discrepancia documental de alcance: logout público es intencional, no demuestra acceso indebido a datos.

**Fuentes:** `auth/auth.controller.ts:84; auth/guards/jwt-auth.guard.ts`.

**Verificación prevista originalmente:** Prueba manual en Swagger sin token y revisión del listado de rutas públicas.

### ARC05 — No cumple

**Requisito original:** El bucket es privado y los archivos se piden con URLs firmadas que vencen. Una URL vencida deja de funcionar.

**Resultado:** Cliente genera URLs object/public sin firma ni vencimiento. No cumple el modelo de bucket privado con URLs temporales; no se inspeccionó política real del proveedor.

**Fuentes:** `archivos/archivos.client.ts:51; archivos/archivos.service.ts:29`.

**Verificación prevista originalmente:** Prueba manual: abrir una URL firmada vencida. Revisión de la política del bucket.

### DAT01 — No cumple

**Requisito original:** Las respuestas de la API usan DTOs con lo mínimo necesario, nunca la entidad completa.

**Resultado:** Hay retornos de entidades y de usuario completo salvo hash. No se cumple la exigencia literal de DTOs mínimos en todas las respuestas; no implica que se haya demostrado fuga de hash.

**Fuentes:** `unidades/unidades.service.ts:77; usuarios/usuarios.service.ts:27,212`.

**Verificación prevista originalmente:** Revisión de las respuestas de usuarios, unidades y vecinos.

### DAT05 — No cumple

**Requisito original:** Las acciones críticas (emitir una liquidación, registrar un pago manual, cerrar una votación, cambiar un rol, resetear una contraseña) dejan registro de quién, cuándo y qué.

**Resultado:** Reset de contraseña guarda el hash sin registrar actor, fecha y acción en un registro de auditoría. Basta este flujo para incumplir el requisito conjunto; no se afirma que todos los módulos carezcan de registros.

**Fuentes:** `usuarios/usuarios.service.ts:130,174`.

**Verificación prevista originalmente:** Prueba manual de cada acción y revisión del registro.
