# admin-consorcios

Integrantes: Ignacio Alcaraz, Patricio Vecino, Juanmanuel Grispo, Felipe Vega Torre, Martin Capece
Sistema de administración de consorcios. TP de Desarrollo de Aplicaciones 2 (UADE).

Monorepo pnpm con dos apps:

```
apps/
├── backend/    NestJS 11 + TypeORM + PostgreSQL   → :4000  (docs en /docs)
└── frontend/   Next.js 16 + Tailwind 4            → :3000
```

Más documentación en [`docs/`](docs/): [visión del producto](docs/producto.md)
y [diseño de mensajería](docs/mensajeria.md).

## Requisitos

- Node >= 22
- pnpm 9 (`corepack enable` lo activa)
- Acceso a la base de Supabase (o un PostgreSQL local: ver abajo)

## Arranque

```bash
pnpm install

# Variables de entorno (una vez)
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# Pegar la DATABASE_URL de Supabase en apps/backend/.env y verificar
pnpm back db:check

# Levanta backend y frontend juntos
pnpm dev
```

Atajos: `pnpm back <script>` y `pnpm front <script>` corren scripts de cada app
(ej: `pnpm back dev`, `pnpm front build`).

## Arquitectura del backend

Cada módulo de negocio vive en `src/modules/<nombre>/` y se compone de:

```
<nombre>.module.ts       cableado del módulo
<nombre>.controller.ts   HTTP: rutas, DTOs, validación de borde
<nombre>.service.ts      reglas de negocio
<nombre>.repository.ts   acceso a datos (TypeORM) — si tiene db
<nombre>.entities.ts     entidades del módulo
<nombre>.client.ts       API externa — si consume una
```

La regla: el controller habla con el service, el service con el repository y
el client. Nadie saltea capas ni hace fetch/SQL por afuera.

`src/modules/consorcios/` es el ejemplo de referencia: copiá esa forma para
cada módulo nuevo. Lo transversal (health, auth futura) va en `src/core/`.

## Diagrama de capas

[Diagrama de capas del sistema](https://app.diagrams.net/#G1MuyywLjsQhaBU75UJVVgfVFXkNM3FEkJ#%7B%22pageId%22%3A%22F38rSkYnARai5AXldVDs%22%7D)

Cubre las cuatro capas (portales, controllers REST, servicios, repositorios) y
las integraciones externas: MercadoPago para pagos y NodeMailer para
comunicados. El archivo vive en Google Drive y se edita en draw.io, así que el
link siempre abre la última versión. Para verlo hace falta permiso de lectura
sobre el archivo; pedíselo a Ignacio.

## Base de datos

Corre en **Supabase**, que es un PostgreSQL administrado: el backend se conecta
con TypeORM como a cualquier Postgres. No usamos `supabase-js` — el acceso a
datos entra por los repositorios, como dice la regla de capas de arriba.

### Conectarse

1. En Supabase: **Connect** (arriba) o **Project Settings → Database**.
2. Copiar la connection string en formato **URI**.
3. Pegarla en `DATABASE_URL` dentro de `apps/backend/.env`, reemplazando
   `[YOUR-PASSWORD]` por la password **de la base** (no la del login de Supabase).
4. Verificar: `pnpm back db:check` — imprime contra qué base pegó y qué tablas ve.

Si la conexión directa (`db.<ref>.supabase.co`) falla por IPv6, usar el
**Session pooler** (puerto `5432`). El *Transaction pooler* (`6543`) no sirve:
no banca prepared statements.

El SSL se prende solo cuando hay `DATABASE_URL`. `.env` está gitignoreado
porque la connection string trae la password; cada uno arma el suyo a partir de
`.env.example`.

### La base es la fuente de verdad

El esquema vive en Supabase y se toca **en SQL**. Las entidades de TypeORM no se
escriben a mano: se generan leyendo la base.

```bash
pnpm back db:generate-entities   # regenera src/database/entities/ desde la base
pnpm back db:verify              # falla si el código no coincide con la base
```

Eso deja las 30 tablas y los 31 enums reflejados en `src/database/entities/`,
un archivo por tabla más `enums.ts` y un barrel `index.ts`. Los archivos
generados llevan un encabezado que lo dice: **editarlos a mano no tiene
sentido**, el próximo `db:generate-entities` los pisa.

El flujo para cambiar el esquema es:

1. Correr el SQL en Supabase (SQL Editor).
2. `pnpm back db:generate-entities`.
3. Commitear el diff de `src/database/entities/` junto con el código que lo usa.

`db:verify` está para CI o para correr antes de un commit: si alguien cambió la
base y no regeneró, salta ahí y no en runtime.

Por eso **no hay `DB_SYNC`**: `synchronize` está fijo en `false`. Si TypeORM
pudiera escribir DDL, una entidad desactualizada alteraría las tablas del grupo
para que coincidan con el código — justo al revés de lo que queremos.

**Excepción: migraciones puntuales.** Cuando un cambio de esquema nace del
código y tiene que quedar versionado (ej.: sumar `SUPER_ADMIN` al enum de
roles), va como migración en `src/database/migrations/` y se aplica con
`pnpm back migration:run`. Después se regenera igual que siempre
(`db:generate-entities`). La tabla `migrations` que TypeORM crea para llevar el
registro es infraestructura: el generador de entities la ignora.

### Detalles del mapeo

- Las columnas `numeric` pasan por un transformer y llegan como `number`. Sin
  eso el driver las entrega como string y `total * 1.1` concatena en vez de
  multiplicar.
- `date` y `time` quedan como `string`: convertirlos a `Date` inventaría una
  hora y una zona horaria que la base no guarda.
- En una FK, la relación se queda con el nombre natural (`consorcio`,
  `creadoPor`) y la columna cruda lleva el sufijo `Id` (`consorcioId`,
  `creadoPorId`).
- No hay `BaseEntity`: 12 de las 30 tablas no tienen `updated_at`, así que cada
  entidad declara exactamente las columnas de su tabla.

### Postgres local

Alternativa para trabajar sin tocar la base compartida: comentar `DATABASE_URL`
y descomentar los `DB_*` del `.env`.

```bash
docker run -d --name pg-consorcios -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=admin_consorcios -p 5432:5432 postgres:16
```

## Autenticación

JWT propio contra la tabla `usuario` (que ya tiene `password_hash`, `rol` y
`activo`). No usamos Supabase Auth: el esquema define los usuarios, así que la
sesión se arma sobre eso.

Para el navegador la sesión viaja en una **cookie httpOnly** (`domus_session`):
el login la setea, el logout la borra y el JS del frontend nunca la ve — eso
neutraliza el robo de token por XSS. El header `Authorization: Bearer` sigue
funcionando en paralelo para Swagger, scripts y clientes sin cookies.

### Roles

| Rol | Qué es |
|---|---|
| `SUPER_ADMIN` | El dueño de la plataforma. Crea consorcios, los asigna y da de alta administradores. Pasa cualquier chequeo de `@Roles()`. |
| `ADMINISTRADOR` | Administra su(s) consorcio(s): expensas, reclamos, vecinos. |
| `VECINO` | Opera sobre sus unidades. |

La jerarquía vive en `RolesGuard`, no en la base: la base solo conoce el enum.

### Crear el primer usuario

No hay endpoint de registro — dejarlo abierto permitiría que cualquiera se dé de
alta como administrador. Los usuarios se crean por CLI:

```bash
pnpm back usuario:crear <email> <password> [SUPER_ADMIN|ADMINISTRADOR|VECINO] [nombre] [apellido]
```

El **superadmin solo se crea así**: la API no permite darse de alta con ese
rol. Los administradores, en cambio, los crea el superadmin desde el panel
(o por `POST /usuarios`). Los vecinos los da de alta el administrador desde la
unidad donde viven (`POST /unidades/:id/vinculos` con `nuevoUsuario`), con una
contraseña inicial que el vecino cambia desde su perfil.

### Endpoints

| Método | Ruta           | Quién puede                          |
|--------|----------------|--------------------------------------|
| POST   | `/auth/login`  | cualquiera — deja la cookie de sesión |
| POST   | `/auth/logout` | cualquiera — borra la cookie          |
| GET    | `/auth/me`     | con sesión (cookie o bearer)          |
| GET    | `/usuarios`    | superadmin: todos (`?rol=`) · admin: los vecinos de sus consorcios. Con `?email=`, busca uno exacto |
| GET    | `/usuarios/:id` | superadmin · admin: sólo vecinos de sus consorcios (404 si no) |
| POST   | `/usuarios`    | superadmin (crea ADMINISTRADOR/VECINO)|
| PATCH  | `/usuarios/:id` | superadmin · admin sobre sus vecinos; `activo` es sólo del superadmin |
| PUT    | `/usuarios/:id/password` | superadmin · admin sobre sus vecinos: le pone una contraseña nueva |
| GET · PATCH | `/perfil` | con sesión: los datos propios (nombre, teléfono, avatar) |
| PUT    | `/perfil/password` | con sesión: cambia la propia, pidiendo la actual |
| GET · PUT | `/perfil/preferencias` | con sesión: cómo recibir los avisos, canal × categoría (ver [Mensajería](#mensajería)) |

Dar de baja una cuenta es del superadmin: un vecino puede vivir en consorcios
de administradores distintos, así que el administrador termina el vínculo en
vez de apagarle la cuenta. Las cuentas de superadmin no se tocan por API. El
avatar tiene que venir de `POST /archivos?destino=avatares`.

```bash
curl -X POST localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@ejemplo.com","password":"..."}'
```

Devuelve `{ accessToken, usuario }`. El token se manda como
`Authorization: Bearer <token>`. Desde `/docs` está el botón **Authorize**.

### Cómo se protegen las rutas

El guard de JWT es **global**: toda ruta pide token salvo que se la marque con
`@Public()`. Un endpoint nuevo nace protegido; abrirlo es una decisión
explícita.

```ts
@Public()                          // sin token (login, health)
@Roles(RolUsuario.ADMINISTRADOR)   // además del token, exige rol
```

Sin `@Roles()`, alcanza con estar logueado. En `consorcios` está aplicado como
referencia: leer es para cualquier usuario logueado (cada uno ve los suyos),
crear/editar/borrar es del superadmin.

### Alcance del administrador

`@Roles()` dice **qué** puede hacer cada rol; el alcance dice **sobre qué**. Un
administrador sólo ve y gestiona los consorcios donde `consorcio.administrador_id`
es él. La sesión trae esos `consorcioIds` (se releen en cada request, así que
reasignar un consorcio pega al instante) y `modules/auth/alcance.ts` concentra
la regla:

- `esGestor(usuario)`: administrador o superadmin.
- `consorciosGestionados(usuario)`: los ids del administrador; `undefined` para
  el superadmin, que ve todo.
- `gestiona(usuario, consorcioId)`.

Cada módulo la aplica igual: los listados filtran por esos consorcios, y un
recurso de otro consorcio responde **404**, no 403, como ya hacía el vecino
con lo ajeno. Un administrador sin consorcios asignados no ve nada.

Config en `.env`: `JWT_SECRET` (obligatorio, la app no arranca sin él) y
`JWT_EXPIRES_IN` (default `1d`). Generar el secreto con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Detalles que están puestos a propósito: el login responde el mismo mensaje para
password mala, email inexistente y usuario inactivo (decir cuál es sirve para
enumerar cuentas), siempre corre un bcrypt aunque el email no exista (si no, el
tiempo de respuesta delata qué usuarios hay), y cada request autenticado relee
el usuario en vez de confiar en el token, para que una baja o un cambio de rol
peguen al instante.

## Panel superadmin (frontend)

`apps/frontend` es hoy el panel del dueño de la plataforma. Está construido
con **shadcn/ui** (Radix + Tailwind 4) y el design system **Domus** del
prototipo mapeado sobre los tokens de shadcn: IBM Plex Sans, paleta clara
cálida, un solo acento azul, sin modo oscuro. Es responsive: en mobile la
sidebar se vuelve un Sheet y los grids colapsan a una columna. Las reglas de
UI (qué componente usar, qué tokens, qué no hacer) están en
[`apps/frontend/CLAUDE.md`](apps/frontend/CLAUDE.md). Cubre el ciclo completo
de un consorcio:

- **Login** con cookie httpOnly. `src/proxy.ts` redirige a `/login` si no hay
  cookie; la validación real (firma, expiración, rol) la hace el backend en
  cada request.
- **Solo superadmin**: cualquier otro rol ve "Sin acceso". El backend además
  rechaza con 403, así que saltarse la pantalla no sirve de nada.
- **Consorcios**: listado con administrador y unidades, alta, edición y
  parametrización (domicilio, fiscal, reglas de liquidación).
- **Administradores**: se crean inline desde el form del consorcio y se
  asignan ahí mismo.

Capas del frontend: los componentes usan `src/services/`, los services usan
`src/lib/api.ts` (único `fetch`, siempre con `credentials: 'include'`), y los
tipos espejan lo que devuelve el backend en `src/types/`.

## Catálogos: unidades, proveedores y categorías

Los datos de base que usan los demás módulos: reclamos se abre sobre una
unidad, con una categoría, y se asigna a un proveedor; expensas liquida sobre
las unidades y carga gastos de los proveedores. Los rubros de gasto, que son
el catálogo propio de expensas, se documentan en [Expensas](#expensas).

Dos criterios comunes:

- **Unidades y proveedores no se borran, se dan de baja** (`activa`/`activo:
  false` por `PATCH`). Boletas, pagos, gastos y reclamos los referencian con
  FK `RESTRICT`: borrarlos rompería la historia.
- **Proveedores y categorías pueden ser compartidos.** Con `consorcio_id`
  vacío aparecen en todos los consorcios, así que sólo el **superadmin** los
  crea o edita; un administrador que lo intenta recibe 403 y tiene que indicar
  `consorcioId`. Filtrar por consorcio devuelve los suyos más los compartidos;
  sin filtro, cada uno ve los de sus consorcios más los compartidos.

### Unidades

| Método | Ruta                                  | Quién |
|--------|---------------------------------------|-------|
| GET    | `/unidades`                           | admin: las de sus consorcios · vecino: las suyas |
| GET    | `/unidades/:id`                       | admin: de sus consorcios · vecino: sólo las suyas (404 si no) |
| POST   | `/unidades`                           | administrador |
| PATCH  | `/unidades/:id`                       | administrador (`activa: false` la da de baja) |
| GET    | `/unidades/:id/vinculos`              | administrador |
| POST   | `/unidades/:id/vinculos`              | administrador: vincula un vecino existente (`usuarioId`) o lo da de alta (`nuevoUsuario`) |
| DELETE | `/unidades/:id/vinculos/:vinculoId`   | administrador: termina el vínculo |

Filtros de `GET /unidades`: `consorcioId`, `incluirInactivas`. Cada unidad trae
`cantidadVecinos` (vínculos vigentes). `GET /unidades/:id/vinculos` acepta
`incluirTerminados=true` para ver el historial.

Reglas:

- La **etiqueta** (`3º B`) es única dentro del consorcio (UNIQUE en la base).
- Los **coeficientes** de las unidades activas de un consorcio no pueden pasar
  el 100%: reparten las expensas, y pasarse cobraría más de lo gastado.
  Quedarse corto se permite porque las unidades se cargan de a una. El tope se
  revisa en el alta, al cambiar el coeficiente y al reactivar una unidad.
- El **consorcio de una unidad no se cambia**: arrastraría boletas y reclamos
  del otro edificio.
- **Alta del vecino.** Con `nuevoUsuario: { nombre, apellido, email, password,
  dni?, telefono? }` se crean la cuenta y el vínculo en una transacción: un
  vecino sin unidad no vería nada y ningún administrador lo encontraría. Si el
  email ya existe responde 409; a esa persona se la busca con
  `GET /usuarios?email=` y se la vincula por `usuarioId`.
- Un **vínculo** une a un usuario con rol `VECINO` y una unidad activa, como
  `PROPIETARIO` o `INQUILINO`. Vincular a un administrador lo haría pasar por
  vecino en reclamos.
- Hay **un solo titular vigente** por unidad: es a quien se le emite la boleta.
- **Terminar un vínculo** le pone `hasta` = hoy y lo deja en el historial
  (quién vivía cuando se abrió un reclamo). Si todavía no había empezado a
  regir, se borra: no hay historia que cuidar, y la base exige `hasta > desde`.
  "Hoy" sale de la base (`CURRENT_DATE`), no del reloj de la app, para que no
  choque con el default de `desde`.

### Proveedores

| Método | Ruta               | Quién |
|--------|--------------------|-------|
| GET    | `/proveedores`     | administrador |
| GET    | `/proveedores/:id` | administrador |
| POST   | `/proveedores`     | administrador (compartido: superadmin) |
| PATCH  | `/proveedores/:id` | administrador (`activo: false` lo da de baja) |

Filtros de `GET /proveedores`: `consorcioId`, `buscar` (razón social y rubro),
`incluirInactivos`. El CUIT va con guiones (`30-12345678-9`): la columna es
`varchar(13)`.

### Categorías de reclamo

| Método | Ruta                       | Quién |
|--------|----------------------------|-------|
| GET    | `/categorias-reclamo`      | cualquier logueado (el vecino las usa en el alta de reclamo) |
| GET    | `/categorias-reclamo/:id`  | cualquier logueado |
| POST   | `/categorias-reclamo`      | administrador (compartida: superadmin) |
| PATCH  | `/categorias-reclamo/:id`  | administrador |
| DELETE | `/categorias-reclamo/:id`  | administrador; 409 si algún reclamo la usa |

`GET /categorias-reclamo?consorcioId=` devuelve las del consorcio más las
compartidas. El **nombre no se repite** (sin distinguir mayúsculas) entre las
que aparecen en la misma lista: una de consorcio no puede llamarse igual que
una compartida. El `icono` es un nombre de Material Symbols (`plumbing`,
`bolt`).

### Tests

Las reglas de cada service tienen tests unitarios con repositorios en memoria
(`*.service.spec.ts`), así que no tocan la base compartida:

```bash
pnpm back test
```

## Reclamos

El vecino abre el reclamo con categoría, descripción y fotos; el administrador
lo asigna a un proveedor, responde sobre la línea de tiempo y lo cierra.

### Endpoints

| Método | Ruta                      | Quién                  |
|--------|---------------------------|------------------------|
| GET    | `/reclamos`               | admin: los de sus consorcios · vecino: los de sus unidades |
| GET    | `/reclamos/resumen`       | totales por estado y tiempo medio de resolución |
| GET    | `/reclamos/:id`           | detalle con adjuntos y línea de tiempo |
| POST   | `/reclamos`               | alta |
| POST   | `/reclamos/:id/mensajes`  | respuesta o nota interna |
| PATCH  | `/reclamos/:id/proveedor` | sólo administrador |
| PATCH  | `/reclamos/:id/estado`    | sólo administrador |

Filtros de `GET /reclamos`: `estado`, `situacion` (`abiertos`/`cerrados`, las
solapas del portal vecino), `prioridad`, `categoriaId`, `consorcioId`,
`unidadId`, `proveedorId`, `buscar` (descripción y código), `pagina`, `limite`.

### Reglas

Las tres primeras las impone la base y el código las respeta, no las duplica:

- **Código `RC-2026-0001`.** La columna es UNIQUE y no tiene default, así que lo
  numera la aplicación. Si dos altas simultáneas sacan el mismo número, el
  UNIQUE rechaza una y el repositorio reintenta.
- **`RESUELTO` ⟺ `cerrado_at`.** Hay un CHECK que los ata: resolver completa la
  fecha y reabrir la limpia, siempre juntos.
- **Hasta 5 fotos** (`CHECK (orden entre 0 y 4)`).
- El **consorcio se deriva de la unidad**, no se recibe: son dos columnas que
  tienen que coincidir.
- La **prioridad la fija el administrador**. Si la eligiera el vecino, todos los
  reclamos entrarían en ALTA.
- El vecino reclama **sobre su unidad**; si está vinculado a una sola, se
  infiere. Un reclamo de otra unidad devuelve 404, no 403: un 403 confirmaría
  que ese reclamo existe.
- Asignar proveedor sobre un reclamo en `NUEVO` lo pasa a `EN_CURSO`.
- Un reclamo `RESUELTO` no acepta mensajes: hay que reabrirlo.
- La **categoría** tiene que ser del consorcio del reclamo o compartida, y el
  **proveedor** además tiene que estar activo. La FK sólo garantiza que
  existan; una categoría o un proveedor de otro edificio devuelve 400.
- Donde dice "administrador" vale también para el **superadmin**, que además
  ve los reclamos de todos los consorcios.

### Línea de tiempo

Cada movimiento deja un `reclamo_evento`: `CREACION`, `ASIGNACION`,
`CAMBIO_ESTADO`, `RESPUESTA` y `NOTA_INTERNA`. Las notas internas
(`visible_para_vecino = false`) sólo las escribe el administrador y sólo él las
ve: al vecino se le devuelve la timeline recortada.

### Fotos

La API recibe URLs ya subidas (`adjuntos: [{ url, nombre }]`), no archivos: el
front sube la foto a [`POST /archivos?destino=reclamos`](#archivos) y manda acá
la URL que eso devuelve. Hasta 5 por reclamo, que es el tope que impone la base.
Una URL que no salió de ahí responde 400.

### Avisos

Las respuestas, la asignación y los cambios de estado le llegan por mail a
quien abrió el reclamo, vía `Notificador` (ver [Mensajería](#mensajería)).
Resolverlo publica el evento `reclamo.cerrado`, que sólo escucha el mail: es
información del vecino, no una novedad del edificio. Avisar nunca corta la
operación: si el aviso falla, la respuesta ya quedó guardada.

## Expensas

El administrador abre la liquidación de un período, carga los gastos del mes,
previsualiza las boletas, las ajusta si hace falta y las emite. Emitir las
convierte en deuda de cada unidad y avisa a los vecinos.

### Ciclo de una liquidación

```
BORRADOR ──previsualizar──▶ PREVISUALIZACION ──emitir──▶ EMITIDA ──cerrar──▶ CERRADA
    ▲                            │
    └── se borra el último gasto ┘
```

- **BORRADOR**: se cargan, editan y borran gastos. Todavía no hay boletas.
- **PREVISUALIZACION**: las boletas están calculadas y el administrador las
  revisa. Cambiar un gasto, el criterio o el vencimiento **recalcula en el
  momento**, así que lo que se ve es siempre lo que se emitiría. Cada
  recálculo reemplaza las boletas (cambian sus ids), pero conserva los
  ajustes manuales.
- **EMITIDA**: las boletas quedan congeladas y el vecino las ve. No se puede
  deshacer: son deuda, y corregirlas va por ajuste en la liquidación
  siguiente.
- **CERRADA**: el período se da por terminado. Sus boletas siguen contando
  como deuda.

El estado `PRORRATEO` del enum no se usa.

### Endpoints

| Método | Ruta                                        | Quién |
|--------|---------------------------------------------|-------|
| GET    | `/liquidaciones`                            | administrador (filtros `consorcioId`, `estado`) |
| GET    | `/liquidaciones/:id`                        | administrador: con sus gastos |
| POST   | `/liquidaciones`                            | administrador: `{ consorcioId, periodo: "2026-09" }` |
| PATCH  | `/liquidaciones/:id`                        | administrador: criterio de prorrateo o vencimiento |
| DELETE | `/liquidaciones/:id`                        | administrador: sólo sin emitir |
| POST   | `/liquidaciones/:id/gastos`                 | administrador |
| PATCH  | `/liquidaciones/:id/gastos/:gastoId`        | administrador |
| DELETE | `/liquidaciones/:id/gastos/:gastoId`        | administrador |
| POST   | `/liquidaciones/:id/previsualizar`          | administrador |
| POST   | `/liquidaciones/:id/emitir`                 | administrador |
| POST   | `/liquidaciones/:id/cerrar`                 | administrador |
| GET    | `/boletas`                                  | grilla de cobranzas, paginada · admin: las de sus consorcios · vecino: las emitidas de sus unidades |
| GET    | `/boletas/resumen`                          | emitido, cobrado, saldo, intereses y el conteo de cada solapa |
| GET    | `/boletas/exportar`                         | la grilla en CSV, sin paginar |
| POST   | `/boletas/recordatorios`                    | administrador: avisa a quienes tienen saldo |
| GET    | `/boletas/:id`                              | con el detalle línea por línea (cada una con su gasto y rubro, para agrupar por rubro); al vecino, 404 si no es suya o no se emitió |
| GET    | `/boletas/:id/pdf`                          | la boleta en PDF, mismos permisos que el detalle |
| PATCH  | `/boletas/:id/ajuste`                       | administrador, sólo en previsualización |
| GET    | `/rubros-gasto`                             | cualquier logueado (`?consorcioId=`: los suyos más los compartidos) |
| POST · PATCH · DELETE | `/rubros-gasto[/:id]`        | administrador (compartido: superadmin); 409 al borrar uno con gastos |

### La grilla de cobranzas

`GET /boletas` es la pantalla de cobranzas del administrador, no una lista
pelada de boletas. Cada fila trae lo que hace falta para decidir a quién
reclamarle:

```jsonc
{
  "items": [{
    "id": "…", "periodo": "2026-08", "fechaVencimiento": "2026-09-10",
    "unidad": { "id": "…", "etiqueta": "3º B", "coeficiente": 1.86 },
    "propietario": { "id": "…", "nombre": "Osvaldo", "apellido": "Pereyra", "email": "…", "telefono": "…" },
    "inquilino": null,              // si está alquilada, quién la ocupa
    "coeficienteAplicado": 1.86,
    "emitido": 155520, "pagado": 60000, "saldo": 95520,
    "medio": "TRANSFERENCIA",       // el del último pago aprobado; null si no hubo
    "ultimoPago": { "id": "…", "fecha": "2026-09-04T17:38:00Z" },  // "Pagado el…" y su recibo
    "estado": "VENCIDA", "interesesMora": 1240.5
  }],
  "total": 48, "pagina": 1, "paginas": 3
}
```

Filtros: `liquidacionId`, `consorcioId`, `unidadId`, `periodo` (AAAA-MM),
`estado`, `situacion`, `buscar`, `pagina`, `limite` (tope 100).

`situacion` son las solapas de la pantalla y **no** es lo mismo que `estado`:
`pendientes` incluye las `PARCIAL`, porque una boleta pagada a medias sigue
teniendo saldo. `pagados` es `PAGADA` y `vencidos`, `VENCIDA`.

`buscar` matchea la etiqueta de la unidad o el nombre de cualquiera de sus
vecinos vigentes: en la grilla se busca "Pereyra", no un uuid.

Al vecino no le viajan `propietario` ni `inquilino`: no necesita el teléfono
del dueño para ver su propia boleta.

**`GET /boletas/resumen`** devuelve los cuatro totales de la cabecera sobre el
mismo alcance que la grilla —`emitido`, `cobrado`, `saldoPendiente`,
`interesesAcumulados`— más `conteos` con `todos`, `pagados`, `pendientes` y
`vencidos` para los números de las solapas. Ignora `estado` y `situacion`: la
cabecera muestra el período completo.

**`GET /boletas/exportar`** es la misma grilla en CSV, sin paginar y con tope
de 5000 filas. Va con `;` y BOM para que Excel en español lo abra en columnas
sin pasar por el asistente. Es CSV y no `.xlsx` a propósito: un xlsx real pide
una dependencia nueva y Excel abre este archivo igual.

**`POST /boletas/recordatorios`** manda un aviso por `Notificador` a cada
vecino de cada boleta **con saldo** del alcance
(`{ boletaId?, liquidacionId?, consorcioId?, periodo?, situacion?, mensaje? }`;
`boletaId` es el botón de enviar de una sola fila). Nunca a
quien ya pagó, y nunca por una liquidación sin emitir: reclamar una deuda que
todavía no existe es peor que no avisar. Devuelve
`{ boletas, avisos, sinDestinatario, fallidos }`; un aviso que falla no corta
los demás.

### Cómo se calcula una boleta

El cálculo vive en `modules/expensas/prorrateo.ts`, separado del service: son
funciones puras, sin base, testeadas con números a mano.

```
ordinarias       = su parte de cada gasto ORDINARIO
extraordinarias  = su parte de cada gasto EXTRAORDINARIO
fondo de reserva = su parte de cada gasto FONDO_RESERVA
                 + porcentaje_fondo_reserva del consorcio × sus ordinarias
saldo anterior   = lo que quedó impago de su boleta anterior
intereses mora   = interés simple sobre ese saldo
ajuste manual    = lo que cargue el administrador
total            = la suma de todo
```

- **La parte de cada gasto** sale del coeficiente de la unidad o, con
  `PARTES_IGUALES`, de dividir por la cantidad de unidades activas. Por
  coeficiente, los de las unidades activas tienen que **sumar exactamente
  100%** para poder previsualizar. El alta de unidades no deja pasarse, pero
  sí quedarse corto mientras se cargan.
- **Centavos exactos.** Todo se calcula en centavos enteros. Los centavos que
  sobran de redondear se reparten de a uno entre las unidades con mayor resto
  (método del resto mayor). Por eso la suma de las boletas es exactamente el
  total de los gastos: $1.000 en tres partes da 333,34 + 333,33 + 333,33, no
  999,99.
- **Deuda.** Se toma la última boleta emitida de la unidad (anterior a este
  período) y se le restan los pagos `APROBADO`. Sólo la última, porque su
  total ya arrastra la deuda de las anteriores.
- **Mora.** `tasa_interes_mora` del consorcio por los días desde el
  vencimiento de esa boleta hasta hoy. Si `periodicidad_mora` es `MENSUAL`, la
  tasa se prorratea por día (30 días = 1 mes), para que una semana de atraso
  no cobre el mes entero. "Hoy" sale de la base, igual que en los vínculos.
- **Detalle.** Cada boleta lleva una línea por gasto (con su `gasto_id`) y una
  línea por fondo, saldo, mora y ajuste cuando no son 0. Es lo que el vecino
  ve desglosado.

### Reglas

- **Una liquidación por consorcio y período** (UNIQUE en la base). El período
  se recibe como `AAAA-MM` y se guarda como el primer día del mes.
- **Vencimiento por defecto**: el `dia_vencimiento` del consorcio en el mes
  siguiente al período, o el último día si el mes es más corto (un 31 en
  febrero cae el 28). Tiene que ser posterior al inicio del período.
- **En orden.** No se abre un período igual o anterior al último emitido, y no
  se emite si queda un período anterior sin emitir. Si no, la deuda se
  arrastraría desde una boleta que todavía no existe.
- **Emitir recalcula por última vez.** Entre la previsualización y la emisión
  puede entrar un pago o cambiar una unidad, y lo emitido tiene que reflejar
  el estado de ese momento. `total_emitido` es la suma de las boletas.
- **Gastos.** El rubro y el proveedor tienen que ser del consorcio o
  compartidos, y el proveedor además tiene que estar activo. Sin
  `naturaleza`, el gasto toma la del rubro: un gasto de "Mantenimiento" puede
  ser extraordinario si es una obra puntual. `cuotaNumero` y `cuotaTotal` van
  juntos. `total_gastos` se recalcula desde los gastos en cada cambio.
- **Origen del gasto.** `reclamoId` y `votacionId` (opcionales; `null`
  desvincula) dicen de dónde salió. Tienen que ser del mismo consorcio, y la
  votación además `APROBADA`: no se cobra lo que la asamblea rechazó.
- **Ajuste manual.** Positivo suma, negativo descuenta y 0 lo quita. Lleva
  motivo obligatorio, porque el vecino lo ve en la boleta, y no puede dejar el
  total negativo.
- **Rubros.** Tienen la misma lógica que las categorías de reclamo:
  compartidos (sólo superadmin) o por consorcio, sin nombres repetidos en la
  misma lista, y no se borran si tienen gastos. Cambiar la naturaleza de un
  rubro no toca los gastos ya cargados.

### Avisos al emitir

Emitir publica `expensas.emitidas`. El consumidor de mail le escribe a cada
vecino vinculado hoy a las unidades liquidadas, con el total de cada una (uno
por persona, aunque tenga varias unidades), y el muro publica la novedad del
período. Publicar no espera a nadie: la emisión no depende del mail.

### PDF de la boleta

`GET /boletas/:id/pdf` la genera al vuelo con `pdfkit`, con los mismos
permisos que el detalle. No se guarda: así siempre muestra el estado y el
saldo de hoy, y `pdf_url` queda sin usar.

### Pendiente

- Marca de envío (`enviada_at`): el registro de cada mail queda en
  `envio_notificacion`, pero la boleta todavía no se marca.
- Importe en letras en el PDF (el servicio SOAP de [producto.md](docs/producto.md)).

## Pagos

El estado de una boleta emitida sale de sus pagos `APROBADO` y del
vencimiento (`modules/expensas/estado-boleta.ts`, función pura):

```
pagado ≥ total                  → PAGADA
con saldo y pasó el vencimiento → VENCIDA
con algún pago                  → PARCIAL
si no                           → PENDIENTE
```

Pagos registra el pago y le pide a expensas que recalcule la boleta: la boleta
es de expensas y pagos no toca sus tablas. `VENCIDA` se marca con un `UPDATE`
antes de cada lectura de boletas, sin cron.

### Endpoints

| Método | Ruta                              | Quién |
|--------|-----------------------------------|-------|
| GET    | `/pagos`                          | admin: los de sus consorcios · vecino: los de sus unidades (filtros `boletaId`, `unidadId`, `estado`) |
| GET    | `/pagos/:id`                      | detalle con su unidad y su boleta; al vecino, 404 si no es de una unidad suya |
| GET    | `/pagos/:id/recibo`               | el recibo en PDF, sólo de un pago aprobado |
| POST   | `/pagos`                          | administrador: pago manual `{ boletaId \| reservaId, monto, medio, fechaPago? }` |
| POST   | `/pagos/mercadopago/preferencia`  | dueño de la boleta o la reserva, o administrador: `{ boletaId }` o `{ reservaId }` → `{ pagoId, initPoint }` |
| POST   | `/pagos/:id/sincronizar`          | mismos permisos que el detalle: le pregunta a Mercado Pago cómo quedó el pago, sin esperar al webhook |
| POST   | `/pagos/webhook/mercadopago`      | público, protegido por firma: lo llama Mercado Pago |

### Reglas

- **Sólo se paga la última boleta emitida de la unidad.** Las anteriores ya
  viajaron como saldo anterior; pagarlas cobraría dos veces la misma deuda.
  Cuando la última queda `PAGADA`, las anteriores impagas de la unidad pasan a
  `PAGADA` también.
- **No más que el saldo.** El prorrateo no arrastra saldo a favor.
- **Manual** (`TRANSFERENCIA`, `EFECTIVO`, `OTRO`): lo carga el administrador
  ya verificado y nace `APROBADO`. `MERCADO_PAGO` sólo entra por su flujo.
- **Mercado Pago.** La preferencia crea un pago `PENDIENTE` por el saldo, con
  su id como `external_reference`. El webhook valida la firma `x-signature`,
  le pide el pago a la API (el cuerpo no se usa) y actualiza el estado:
  `approved` → `APROBADO`, `rejected`/`cancelled` → `RECHAZADO`,
  `refunded`/`charged_back` → `REINTEGRADO`. Es idempotente, y un intento
  rechazado que llega tarde no pisa uno aprobado. Un reintegro vuelve la
  boleta atrás.
- **Un checkout abierto por boleta.** Pedir otra preferencia con un pago
  `PENDIENTE` por el mismo saldo devuelve ese mismo checkout (otra pestaña o
  un doble click no abren un segundo cobro). Si el saldo cambió, el viejo se
  marca `RECHAZADO` y se abre uno nuevo. Si igual entra plata de más (se pagó
  el checkout viejo, o dos intentos de la misma preferencia), el pago se
  registra porque el cobro ya ocurrió, y se le avisa al administrador para que
  devuelva la diferencia desde Mercado Pago.
- Al aprobarse un pago se avisa a los vecinos de la unidad por `Notificador`;
  si el aviso falla, el pago queda igual.

### Recibo

Cuando un pago queda `APROBADO` por primera vez se le asigna
`recibo_numero` con el formato `0001-00000001`: punto de venta fijo más un
correlativo que sale de la secuencia `recibo_pago_numero` de la base
(migración `SecuenciaNumeroRecibo`). Es una secuencia y no un `max(…) + 1`
porque el webhook de Mercado Pago y un pago manual pueden aprobarse en el
mismo instante y llevarse el mismo número.

El número se asigna **una sola vez**: el webhook reintenta, y un comprobante
que cambia de número en cada aviso no sirve como comprobante. Si un pago se
reintegra y después se vuelve a aprobar, conserva el suyo.

`GET /pagos/:id/recibo` lo genera al vuelo con `pdfkit`, igual que la boleta
y por el mismo motivo: así siempre refleja el estado de hoy. `recibo_url`
queda sin usar.

Cuando cada administrador tenga su propio punto de venta, `0001` pasa a ser
una columna del consorcio y la secuencia se vuelve una por punto de venta.

### Configurar Mercado Pago

En `apps/backend/.env`, con credenciales **de prueba**: `MP_ACCESS_TOKEN`,
`MP_WEBHOOK_SECRET`, `MP_NOTIFICATION_URL`, `FRONTEND_URL` y `MP_RETURN_PATH`
(ver `.env.example`; por defecto `/vecino/expensas/pago`). El vecino vuelve a
`FRONTEND_URL + MP_RETURN_PATH` con
`?pago=aprobado|pendiente|rechazado`, y Mercado Pago agrega
`external_reference`, que es el id de nuestro pago. Con ese id el front llama a
`POST /pagos/:id/sincronizar` para mostrar el resultado: así no depende de que
el webhook ya haya llegado. Los dos aplican la misma transición, y es
condicional (sólo si el pago sigue en el estado que se leyó), así que el recibo
se numera y el aviso sale una sola vez aunque lleguen juntos. En local, el webhook necesita una URL pública: un túnel a
`http://localhost:4000/api/pagos/webhook/mercadopago`. Sin token, la
preferencia responde 503 y el resto de la app anda igual.

## Reservas de amenities

El vecino reserva el SUM desde su portal y el administrador gestiona esas
reservas. Las reglas no están en el código: las declara cada amenity en sus
columnas (horario, anticipación, duración, franjas, cancelación, lugares, si
requiere aprobación, si bloquea al que debe expensas). `reglamento` es el texto
libre que el vecino lee antes de confirmar ("Música hasta las 01:00").

### Endpoints

| Método | Ruta                                       | Quién |
|--------|--------------------------------------------|-------|
| GET    | `/amenities`                               | admin: los de sus consorcios · vecino: los activos de los consorcios donde vive |
| GET    | `/amenities/:id`                           | idem; ajeno al vecino, 404 |
| POST   | `/amenities`                               | administrador |
| PATCH  | `/amenities/:id`                           | administrador (`activo: false` lo da de baja) |
| GET    | `/amenities/:id/disponibilidad?fecha=`     | cualquier logueado: la ventana del día y lo ocupado |
| GET    | `/amenities/:id/calendario?desde=&hasta=`  | cualquier logueado: `DISPONIBLE`, `PARCIAL`, `SIN_LUGAR` o `PASADO` por día (hasta 62 días), para el calendario mensual |
| GET    | `/amenities/:id/bloqueos`                  | administrador (filtros `desde`, `hasta`) |
| POST   | `/amenities/:id/bloqueos`                  | administrador |
| DELETE | `/amenities/:id/bloqueos/:bloqueoId`       | administrador |
| GET    | `/reservas`                                | admin: las de sus consorcios · vecino: las de sus unidades |
| GET    | `/reservas/:id`                            | idem; ajena al vecino, 404 |
| POST   | `/reservas`                                | vecino sobre su unidad · admin indicando `unidadId` |
| PATCH  | `/reservas/:id/aprobar`                    | administrador |
| PATCH  | `/reservas/:id/rechazar`                   | administrador (`motivoRechazo` obligatorio) |
| PATCH  | `/reservas/:id/cancelar`                   | el vecino dueño o el administrador |
| PATCH  | `/reservas/:id/sena-devuelta`              | administrador: registra que devolvió la seña |

Filtros de `GET /reservas`: `amenityId`, `consorcioId`, `unidadId`, `estado`,
`situacion` (`proximas`/`pasadas`), `desde`, `hasta`, `pagina`, `limite`.

Los amenities no se borran, se dan de baja: las reservas los referencian con FK
`RESTRICT`. Uno inactivo no acepta reservas nuevas, pero las ya aprobadas siguen.

### Ciclo de una reserva

```
          ┌─ requiereAprobacion ─▶ PENDIENTE ─aprobar─▶ APROBADA ─(pasó)─▶ FINALIZADA
alta ─────┤                            │                   │
          └─ sin aprobación ───────────┼───────────────────┘
                                       │                   │
                                  rechazar             cancelar
                                       ▼                   ▼
                                  RECHAZADA           CANCELADA
```

`PENDIENTE` y `APROBADA` **ocupan el calendario**; `RECHAZADA` y `CANCELADA` lo
liberan. Una solicitud sin resolver reserva el lugar a propósito: si no, dos
vecinos podrían pedir el mismo sábado y habría que rechazar a uno después de
haberle dicho "esperá".

### Franjas fijas

Con `duracionFranjaMinutos` (por ejemplo 240, "franjas de 4 horas") el amenity
se reserva por turnos que arrancan en la apertura: de 10:00 a 02:00 son
10–14, 14–18, 18–22 y 22–02. Una reserva tiene que empezar en el borde de una
franja y ocupar franjas enteras (una o varias seguidas, hasta la duración
máxima); si no, 400. Un resto de la ventana que no llega a una franja no se
ofrece. `GET /amenities/:id/disponibilidad` devuelve `franjas` con cada una
resuelta: `LIBRE`, `OCUPADA`, `BLOQUEADA` o `PASADA`, y `lugaresLibres`. Sin
franjas, `franjas` es null y el horario es libre.

### Cómo se recibe la franja

La API toma `fecha` + `horaInicio` + `horaFin`, no instantes:

```json
{ "amenityId": "…", "fecha": "2026-10-05", "horaInicio": "12:00", "horaFin": "16:00" }
```

`hora_apertura` y `hora_cierre` son `time` y llegan como string (`'08:00:00'`):
no tienen día ni zona. Recibiendo la hora de pared, contrastarla con la ventana
es aritmética de minutos (`modules/reservas/horario.ts`, función pura y
testeada), y el instante absoluto lo arma Postgres con `AT TIME ZONE`, que sabe
de horarios de verano. Así no se inventa ninguna zona en TypeScript, igual que
con `date` y `time` en el resto del proyecto.

La zona es una constante del módulo (`ZONA_POR_DEFECTO`): hoy todos los
consorcios son argentinos. Cuando haya uno que no lo sea, pasa a ser una columna
de `consorcio` y sólo cambia quien la llama.

### Reglas

- **La franja entra en la ventana del amenity.** Terminar exactamente a la hora
  de cierre es válido: cierra a esa hora, no antes.
- **Medianoche.** Un `horaFin` igual o anterior a `horaInicio` es del día
  siguiente (de 20:00 a 02:00; de 13:00 a 13:00 son 24 h), y `fecha` es el día
  en que empieza. Lo mismo con el amenity: un SUM de 10:00 a 02:00 cierra en
  la madrugada siguiente, y apertura igual a cierre es abierto las 24 h. Una
  franja de 00:30 a 01:30 cae en la ventana que abrió la noche anterior.
  `GET /amenities/:id/disponibilidad` devuelve `cierraAlDiaSiguiente` y, en
  ese caso, lo ocupado hasta el cierre de la madrugada.
- **Duración máxima y anticipación mínima**, si el amenity las define. La
  anticipación le da margen al administrador para aprobar.
- **El horario tiene que estar en el futuro**, medido con el reloj de la base
  (`now()`), no con el del proceso.
- **El amenity tiene que ser del mismo consorcio que la unidad.** `reserva` no
  tiene `consorcio_id`: el consorcio llega por el amenity y por la unidad, y
  nada en la base obliga a que coincidan.
- **El vecino reserva sobre su unidad**; si está vinculado a una sola, se
  infiere. Una reserva ajena devuelve 404, no 403: un 403 confirmaría que existe.
- **No se solapa** con otra reserva que ocupe el amenity. Los intervalos son
  semiabiertos `[inicio, fin)`, así que de 10 a 12 y de 12 a 14 conviven.
- **Lugares.** Con `lugares` > 1 (la cochera de visitas tiene 2) entran tantas
  reservas simultáneas como lugares. Cada reserva ocupa un `lugar` concreto: el
  alta toma el primero que nadie usa en todo el horario, con el amenity
  bloqueado, y responde 409 "No quedan lugares" si no hay. El calendario marca
  `SIN_LUGAR` sólo donde se juntan tantas reservas como lugares, y cada franja
  informa `lugaresLibres`. Bajar `lugares` no toca las reservas que ya están.
- **Aprobar revalida el calendario**: entre el pedido y la aprobación pudo
  entrar un bloqueo o aprobarse otra reserva.
- **Cancelar sólo antes de que empiece.** Cancelar algo que ya pasó no es
  cancelar, es reescribir la historia. Además, con `cancelacionMinimaHoras` el
  vecino cancela hasta esas horas antes ("Cancelable hasta 24 h antes"); la
  administración puede hasta el inicio. Cada reserva trae `cancelableHasta`
  (null si ya no se puede cancelar).
- **Con `bloquea_con_deuda`**, una unidad con boletas `VENCIDA` no puede
  reservar. Reservas no toca las tablas de expensas: le pregunta a
  `ExpensasService.tieneDeudaVencida`.

### Seña

Si el amenity tiene `monto_sena`, cada reserva trae
`sena: { monto, pagada, pagoId, devueltaAt }` (null si no pide seña). La seña
se paga por pagos, igual que una boleta: `POST /pagos/mercadopago/preferencia`
con `{ reservaId }`, o el administrador la registra a mano con `POST /pagos`.
El pago es `SENA_RESERVA` con `reserva_id` (el CHECK `ck_pago_destino` de la
base exige uno u otro destino). Sólo se paga mientras la reserva está
`PENDIENTE` o `APROBADA` y no empezó, y nunca más que lo que falta. Si igual
entra de más, se avisa al administrador, como en expensas.

La devolución la registra el administrador (`PATCH /reservas/:id/sena-devuelta`)
una vez que la reserva terminó, se canceló o se rechazó: guarda
`sena_devuelta_at` y le avisa a quien reservó. La plata se devuelve por fuera
del sistema. El estado de la seña sale de los pagos aprobados, así que un
reintegro de Mercado Pago la vuelve a "pendiente" solo.

### Bloqueos de mantenimiento

El administrador cierra el amenity un rango de fechas (`amenity_bloqueo`) y ahí
no se puede reservar. Un bloqueo que pisa reservas vigentes se **rechaza con
409**: tiene que enterarse de que está dejando gente sin el SUM. Con
`cancelarReservas: true` las cancela y le avisa a cada solicitante. Puede empezar
en el pasado, porque un escape de agua no avisa con anticipación.

### Estados que resuelve el reloj

Antes de cada lectura, un `UPDATE` cierra lo que el tiempo ya resolvió, igual que
`marcarVencidas()` en expensas y sin cron: una `APROBADA` cuyo `fin` pasó queda
`FINALIZADA`, y una `PENDIENTE` cuyo `inicio` pasó queda `RECHAZADA` con motivo
automático. Dejarla pendiente para siempre ensucia la bandeja del administrador
y le miente al vecino.

### Qué impone la base

Tres reglas no las decide el código, las garantiza Postgres (y el generador de
entities no las muestra, porque sólo lee PK, FK y UNIQUE):

- `ex_reserva_solapada`: un `EXCLUDE USING gist` sobre
  `(amenity_id, lugar, tstzrange(inicio, fin))` con
  `WHERE estado IN ('PENDIENTE','APROBADA')`: dos reservas no se pisan dentro
  del mismo lugar (migración `ReglasDeAmenities`). Es la lista de estados que ocupan
  el calendario, y `ESTADOS_QUE_OCUPAN` en el repositorio la espeja: si se
  separaran, el código y la base dirían cosas distintas. El rango es `[)`, igual
  que el chequeo del service.
- `ck_reserva_rango` y `ck_bloqueo_rango`: `fin > inicio`, `hasta > desde`.
- `ck_amenity_sena`: `monto_sena >= 0`.

Los triggers `tg_reserva_updated` y `tg_amenity_updated` mantienen `updated_at`:
el código no lo escribe.

### Concurrencia

El alta corre en una transacción que bloquea la fila del amenity
(`SELECT … FOR UPDATE`) antes de mirar el calendario: el `SELECT` de chequeo y el
`INSERT` no son atómicos, y sin el lock dos pedidos simultáneos ven el horario
libre y los dos insertan. Se bloquea sólo esa fila, así dos amenities distintos
se reservan en paralelo. El alta de un bloqueo toma el mismo lock y recién ahí
mira qué reservas pisa.

El chequeo previo existe para devolver un 409 en castellano; si algo lo esquiva,
el `EXCLUDE` de la base lo frena igual y el repositorio traduce el `23P01` al
mismo 409.

### Pendiente

- `cupo_personas` se guarda pero no se valida contra nada: hoy no se pide cuánta
  gente va.

## Archivos

`POST /archivos` es la **única** forma de meter un archivo en el sistema. Todo
lo demás guarda la URL que devuelve: `reclamo_adjunto.url`,
`gasto.comprobante_url`, `novedad_adjunto.url`, `votacion.adjunto_url`,
`asamblea.acta_url` y `usuario.avatar_url`.

Se sube con `multipart/form-data`, campo `archivo`, y el destino va en la
query. Devuelve `{ url, ruta, tipo, tamanio }`.

```bash
curl -X POST "$API/archivos?destino=reclamos" \
  -H "Authorization: Bearer $TOKEN" \
  -F "archivo=@foto.jpg"
```

### Destinos

Cada columna `*_url` de la base tiene el suyo, con sus propias reglas:

| Destino | Tipos | Máximo | Quién |
|---|---|---|---|
| `reclamos` | JPG, PNG, WEBP | 8 MB | cualquiera con sesión |
| `comprobantes` | JPG, PNG, WEBP, PDF | 10 MB | administrador |
| `novedades` | JPG, PNG, WEBP, PDF | 10 MB | administrador |
| `votaciones` | JPG, PNG, WEBP, PDF | 10 MB | administrador |
| `actas` | PDF | 10 MB | administrador |
| `avatares` | JPG, PNG, WEBP | 2 MB | cualquiera con sesión |

Que las fotos de un reclamo no acepten PDF, y que un acta sólo acepte PDF, no
es capricho: separar los destinos evita que un archivo termine guardado donde
no corresponde, y hace que cada pantalla pueda confiar en lo que va a recibir.

### Reglas

- **El tipo se detecta por el contenido, no por el `Content-Type`.** Ese header
  lo escribe el cliente: con cambiarle la extensión a un ejecutable alcanzaría
  para que entrara como imagen. Se miran los primeros bytes (`detectarTipo`).
- **El nombre original nunca se usa en la ruta.** Viene del cliente y puede
  traer barras o `..`. La ruta es `destino/usuarioId/uuid.ext`.
- **El uuid hace que la URL no se pueda adivinar**, y el `usuarioId` en la ruta
  es lo que permite saber de quién es un archivo a la hora de borrarlo.
- **Los módulos que guardan una URL la validan** con
  `ArchivosService.exigirPropia(url, destino)`: tiene que ser de nuestro bucket
  y del destino que corresponde. Hoy lo hacen las fotos de reclamos, el
  comprobante de un gasto y el acta de una asamblea; una URL externa o de otro
  destino responde 400.
- `DELETE /archivos?url=…` borra un archivo propio —la foto que el vecino saca
  y descarta antes de mandar el reclamo—. Cada uno borra sólo lo que subió y
  el superadmin, cualquiera: la ruta dice quién lo subió pero no de qué
  consorcio es.
- Sin las variables de entorno configuradas, responde 503 y el resto de la app
  anda igual, igual que Mercado Pago.

### Configurar

En Supabase → Storage, crear un bucket llamado `domus` y marcarlo **público**.
Después, las tres variables de `.env.example`: `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_STORAGE_BUCKET`.

### Pendiente

- **El bucket es público.** Cualquiera con la URL ve el archivo, y la foto del
  baño de un vecino es información suya. Hoy lo que protege es que la URL lleva
  un uuid y no se puede adivinar, que es lo que se banca el esquema actual:
  las columnas de la base se llaman `url` y guardan una URL. Hacerlo bien es
  bucket privado y URLs firmadas al leer, pero eso implica guardar la **ruta**
  en vez de la URL y tocar todos los módulos que hoy leen esas columnas. Por
  eso la subida ya devuelve `ruta` además de `url`: el día que se haga el
  cambio, el dato está.

## Inicio del vecino

`GET /inicio` (sólo rol `VECINO`) arma de una sola vez lo que la app necesita
apenas abre, para que el celular no encadene cuatro llamadas antes de pintar
la primera pantalla. El módulo (`modules/inicio/`) no tiene tablas ni
repository: compone lo que ya saben usuarios, unidades, expensas, reclamos,
asambleas, reservas, votaciones y novedades.

```jsonc
{
  "usuario": { "id": "…", "nombre": "Julieta", "apellido": "Sosa", "avatarUrl": null },
  "unidades": [{
    "id": "…", "etiqueta": "5º C", "coeficiente": 1.74,
    "vinculo": "PROPIETARIO", "esTitular": true,
    "consorcio": { "id": "…", "nombre": "…", "calle": "Av. Rivadavia", "numero": "4820", "barrio": "Almagro" },
    "expensas": {                       // null si el consorcio nunca emitió
      "boletaId": "…", "periodo": "2026-08", "fechaVencimiento": "2026-09-10",
      "total": 145320.5, "pagado": 0, "saldo": 145320.5,
      "estado": "PENDIENTE", "diasParaVencer": 6,
      "ultimoPago": null               // { id, fecha }: "Pagaste … el 04/09" y "Ver recibo"
    },
    "reclamosAbiertos": 1
  }],
  "proximosEventos": [               // de la más cercana a la más lejana, hasta 10
    { "tipo": "RESERVA", "id": "…", "titulo": "SUM", "fecha": "2026-10-05T21:00:00Z",
      "fin": "2026-10-06T01:00:00Z", "unidadId": "…", "amenityId": "…" },
    { "tipo": "ASAMBLEA", "id": "…", "titulo": "Asamblea ordinaria", "fecha": "2026-10-12T22:00:00Z",
      "lugar": "SUM del edificio", "estado": "CONVOCADA", "consorcioId": "…",
      "quorumPorcentaje": 54.3, "quorumRequerido": 60, "miAsistencia": "SIN_RESPONDER" }
  ],
  "amenities": [                     // los accesos rápidos: "Reservar SUM · Libre hoy"
    { "id": "…", "nombre": "SUM", "icono": "deck", "consorcioId": "…",
      "reservasHoy": 0, "bloqueadoHoy": false, "libreHoy": true }
  ],
  "novedades": [                     // las últimas 5 del muro, fijadas primero
    { "id": "…", "titulo": "Corte de agua el martes", "cuerpo": "…", "fijada": true,
      "publicadaAt": "2026-10-03T12:00:00Z", "leida": false, "novedadAdjuntos": [] }
  ]
}
```

Viene una lista porque un vecino puede estar vinculado a varias unidades (y a
varios consorcios); el front elige cuál muestra arriba.

**Próximos eventos** junta las asambleas convocadas o en curso de sus
consorcios, sus reservas aprobadas que todavía no empezaron (de los próximos
30 días) y las votaciones abiertas (con `fecha` = cuándo cierran). Acá un `[]`
sí quiere decir que no tiene nada por delante.

## Panel del administrador

`GET /panel` (rol `ADMINISTRADOR`; el superadmin ve todos los consorcios) arma
la pantalla 01 del prototipo de una sola vez. Como `inicio`, el módulo
(`modules/panel/`) no tiene tablas: compone lo que saben expensas, reclamos,
reservas, votaciones y asambleas, cada uno con su alcance.

```jsonc
{
  "periodo": "2026-08",                // ?periodo=AAAA-MM; sin él, el último emitido
  "consorcios": 6, "unidades": 214,
  "cobranza": {
    "emitido": 38947180, "cobrado": 33612940, "pendiente": 5334240,
    "vencido": 4120000, "unidadesVencidas": 31,
    "porcentajeCobrado": 86.3, "morosidad": 10.6,
    "anterior": { "periodo": "2026-07", "emitido": 37163000, "cobrado": 34200000, "morosidad": 11.8 }
  },
  "actividadHoy": { "reclamosAbiertos": 12, "reservas": 5, "reservasPendientes": 2, "votacionesActivas": 2 },
  "serie": [{ "periodo": "2026-03", "emitido": 0, "cobrado": 0 }],   // 6 meses
  "atencion": [
    { "tipo": "DEUDA_ANTIGUA", "consorcio": "…", "unidades": 7, "saldo": 2184900, "dias": 60 },
    { "tipo": "LIQUIDACION_SIN_EMITIR", "consorcio": "…", "periodo": "2026-08", "fechaVencimiento": null },
    { "tipo": "QUORUM_BAJO", "asambleaId": "…", "quorumPorcentaje": 54.3, "quorumRequerido": 60 },
    { "tipo": "RECLAMO_SIN_ASIGNAR", "reclamoId": "…", "codigo": "RC-2026-0184", "unidad": "6º B" }
  ],
  "porConsorcio": [{ "id": "…", "nombre": "…", "unidades": 48, "emitido": 8412560,
                     "cobrado": 6998310, "pendiente": 1414250, "morosidad": 16.8, "estado": "ATENCION" }]
}
```

- **Emitido** es la suma de las boletas de liquidaciones emitidas o cerradas
  del período (una previsualización todavía no es deuda), igual que en
  `/boletas/resumen`.
- **Morosidad** es el saldo de las boletas **vencidas** sobre lo emitido: lo que
  todavía no venció no es mora aunque no esté pagado.
- **Estado del consorcio**: `SIN_EMITIR` si no emitió el período; si no,
  `MOROSIDAD_ALTA` desde 20%, `ATENCION` desde 10% y `AL_DIA` por debajo.
- **Requiere atención**: unidades con una boleta vencida hace más de 60 días,
  consorcios sin el período emitido, asambleas convocadas de los próximos 15
  días por debajo del quórum y reclamos `NUEVO` sin proveedor hace más de 2
  días. Los umbrales son constantes de `panel.service.ts` e `indicadores.ts`.

## Asambleas

Módulo `src/modules/asambleas/`. Diseño en
[docs/superpowers/specs/2026-10-02-asambleas-design.md](docs/superpowers/specs/2026-10-02-asambleas-design.md).

### Ciclo

`BORRADOR → CONVOCADA → EN_CURSO → CERRADA | CERRADA_SIN_QUORUM`

- Sólo un borrador se edita, se borra o cambia su orden del día.
- **Convocar** arma el padrón: una asistencia `SIN_RESPONDER` por unidad
  activa, con el coeficiente copiado a ese momento. Avisa a los vecinos.
- **Iniciar** no exige quórum (segunda convocatoria).
- **Cerrar** elige el estado final según el quórum alcanzado.

### Endpoints

| Método | Ruta | Rol |
|---|---|---|
| GET | `/asambleas` | ambos |
| GET | `/asambleas/:id` | ambos |
| POST | `/asambleas` | admin |
| PATCH | `/asambleas/:id` | admin |
| DELETE | `/asambleas/:id` | admin |
| PUT | `/asambleas/:id/orden-dia` | admin |
| POST | `/asambleas/:id/convocar` · `/iniciar` · `/cerrar` | admin |
| PATCH | `/asambleas/:id/acta` | admin |
| GET | `/asambleas/:id/acta-borrador` | admin: el borrador del acta en PDF |
| GET | `/asambleas/:id/asistencias` | admin |
| PATCH | `/asambleas/:id/asistencias/:unidadId` | admin |
| PUT | `/asambleas/:id/asistencia` | vecino |

### Quórum

Suma de coeficientes `ASISTE` + `CON_PODER` sobre el total convocado
(`quorum.ts`). El vecino responde sólo `ASISTE` / `NO_ASISTE`; los poderes los
registra el administrador indicando la unidad apoderada. El vecino ve el
quórum y su propia respuesta, nunca los nombres de los demás.

### Acta

`GET /asambleas/:id/acta-borrador` arma un borrador en PDF con lo que el
sistema sabe (quórum, asistencia con poderes, orden del día y resultado de cada
votación) para completar y firmar. Es el "Descargar acta" del detalle.

El acta firmada se sube primero con `POST /archivos?destino=actas` y después se guarda
su URL con `PATCH /asambleas/:id/acta`. Una URL que no venga de ahí —externa
o de otro destino— responde 400.

No se puede cerrar una asamblea con votaciones abiertas (409): primero se
cierran sus votaciones.

### Avisos

Convocar publica `asamblea.creada`: mail a los vecinos y novedad en el muro.
48 h antes, `asamblea.recordatorio` sale sólo por mail. Lo dispara un cron cada
10 minutos (`recordatorio-asambleas.ts`), el único del proyecto: los demás
estados que resuelve el tiempo se actualizan al leer, pero este aviso tiene que
salir aunque nadie abra la app. El mismo `UPDATE` que elige las asambleas marca
`recordatorio_enviado_at`, así sale una sola vez aunque haya dos instancias.

## Votaciones

Módulo `src/modules/votaciones/`. Diseño en
[docs/superpowers/specs/2026-10-03-votaciones-design.md](docs/superpowers/specs/2026-10-03-votaciones-design.md).

### Dos tipos

- **Independiente**: se vota sólo desde la app, entre `apertura` y `cierre`.
  Si pasa el cierre y sigue abierta, se cierra sola en la próxima consulta
  (sin cron, como las reservas vencidas).
- **De asamblea**: se crea sobre un punto `CON_VOTACION` del orden del día
  (uno por punto), o con `asambleaId`, que suma un punto nuevo al final del
  orden del día aunque la asamblea ya esté convocada (el "Agregar votación"
  del detalle). El punto y la votación se crean en la misma transacción. Se vota con la asamblea `EN_CURSO`; con
  `permiteVotoAnticipado`, el vecino también puede votar desde la app con la
  asamblea convocada, y el voto queda `anticipado`. La cierra el admin.

Ciclo: `BORRADOR → ABIERTA → CERRADA`. Sólo un borrador se edita o se borra.

### Quién vota

- **Padrón** (`padron.ts`): unidades activas con vínculo vigente. Con
  `SOLO_PROPIETARIOS` vota un propietario (el inquilino ve, no vota); con
  `TODAS_LAS_UNIDADES`, cualquiera vinculado. Peso: coeficiente o 1 según
  `formaConteo`. Con `bloqueaConDeuda`, una unidad con expensas vencidas no vota.
- **Un voto por unidad, sin cambios.** El vecino vota desde la app
  (`POST /votaciones/:id/votos`); la administración carga los presenciales de
  una asamblea en curso (`POST /votaciones/:id/votos/:unidadId`). Si la unidad
  ya votó, 409 diciendo cuándo y si fue desde la app o lo cargó la
  administración. El UNIQUE `(votacion_id, unidad_id)` de la base cubre los
  votos simultáneos.

### Resultado

`escrutinio.ts` decide con "A favor" y "En contra", que son fijas; las demás
opciones (ej. "Abstención") se informan pero no deciden.

| Mayoría | Se aprueba si A favor… |
|---|---|
| `SIMPLE_PRESENTES` | supera a En contra |
| `ABSOLUTA` | supera el 50% del peso del padrón |
| `DOS_TERCIOS` | llega a 2/3 del peso del padrón |

Empate exacto: decide `desempate`. `SIN_QUORUM` si nadie votó o si es de
asamblea y la asamblea no tenía quórum al cerrar la votación. Un gasto que sale
de una votación sólo se carga si está `APROBADA` (ya lo valida expensas).

### Endpoints

| Método | Ruta | Rol |
|---|---|---|
| GET | `/votaciones` · `/votaciones/:id` | ambos |
| POST | `/votaciones` | admin |
| PATCH · DELETE | `/votaciones/:id` | admin |
| PUT | `/votaciones/:id/opciones` | admin |
| POST | `/votaciones/:id/publicar` · `/cerrar` | admin |
| GET | `/votaciones/padron?consorcioId=&padron=&formaConteo=` | admin: vista previa del padrón antes de crear (habilitadas, peso total y unidades sin votante) |
| GET | `/votaciones/:id/votos` | admin |
| POST | `/votaciones/:id/votos/:unidadId` | admin |
| POST | `/votaciones/:id/votos` | vecino |

El vecino ve sus unidades habilitadas con su peso ("tu voto vale 1,74%") y su
voto; el parcial, sólo si `mostrarParcial` o ya cerró. El presupuesto adjunto
(`adjuntoUrl`) tiene que venir de `POST /archivos?destino=votaciones`.

### Avisos

Publicar una independiente emite `votacion.nueva` y cerrar cualquiera,
`votacion.cerrada` (también la que se cierra sola al vencer): mail y novedad en
el muro. Las de asamblea, al publicarse, avisan por mail a cada vecino sin
pasar por el muro, que ya anunció la asamblea.

### Pendiente

- El padrón no se congela al publicar: se calcula con las unidades y vínculos
  de hoy, también al mirar una votación ya cerrada. El resultado guardado no
  cambia, pero el peso total que se muestra sí podría.

## Novedades

El muro de cada edificio (`modules/novedades/`). Hay dos tipos de novedad: los
comunicados que escribe el administrador y los avisos automáticos que publica
el muro por eventos de dominio (ver [Mensajería](#mensajería)).

| Método | Ruta | Quién |
|---|---|---|
| GET | `/novedades` | admin: las de sus consorcios, con `lecturas` · vecino: las activas de donde vive, con `leida` |
| GET | `/novedades/:id` | idem; ajena, 404 |
| POST | `/novedades` | administrador: `{ consorcioId, titulo, cuerpo, fijada?, adjuntos? }` |
| PATCH | `/novedades/:id` | administrador: título, cuerpo, `fijada`; `activa: false` la saca del muro |
| PUT | `/novedades/:id/lectura` | vecino: la marca como leída (repetirlo no hace nada) |

- Fijadas primero, después de la más nueva a la más vieja. Filtros: `consorcioId`,
  `incluirInactivas` (sólo admin), `pagina`, `limite`.
- Los adjuntos se suben antes con `POST /archivos?destino=novedades`; una URL que
  no salió de ahí responde 400.
- Publicar un comunicado emite `novedad.publicada`, que les llega por mail a los
  vecinos. Las novedades automáticas salen en nombre del administrador del
  consorcio.

## Mensajería

Implementa [docs/mensajeria.md](docs/mensajeria.md): pub/sub con RabbitMQ. Los
services publican **eventos de dominio** sin saber quién los escucha; los
consumidores deciden qué hacer con cada uno.

```
services ──publicar()──▶ exchange domus.eventos (topic)
                            ├─ q.email-notificador        (#)  → mail a quien corresponda
                            ├─ q.bandeja-notificaciones   (#)  → aviso en el centro de notificaciones
                            └─ q.muro-novedades-publicador (asamblea.creada, votacion.nueva,
                                                            votacion.cerrada, expensas.emitidas) → novedad
```

| Evento | Lo publica | Mail | Muro |
|---|---|---|---|
| `expensas.emitidas` | emitir una liquidación | vecinos de las unidades, con su total | ✓ |
| `asamblea.creada` | convocar una asamblea | vecinos del consorcio | ✓ |
| `asamblea.recordatorio` | cron, 48 h antes | vecinos del consorcio | — |
| `votacion.nueva` | publicar una votación independiente | vecinos del consorcio | ✓ |
| `votacion.cerrada` | cerrar una votación (o que venza) | vecinos del consorcio | ✓ |
| `reclamo.cerrado` | resolver un reclamo | quien lo abrió | — |
| `novedad.publicada` | publicar un comunicado | vecinos del consorcio | — |
| `aviso.directo` | `Notificador.enviar()`: reservas, pagos, respuestas, recordatorios de deuda | una persona | — |

### Piezas

- `core/mensajeria/`: conexión (`amqplib` + `amqp-connection-manager`, que
  reconecta sola), el sobre común validado de los dos lados (`eventos.ts`), la
  topología y `PublicadorEventos`. Publicar **nunca bloquea ni lanza**: no
  espera la confirmación del broker, y un error queda en el log.
- `core/notificaciones/Notificador`: los avisos a una persona. Publica
  `aviso.directo`; los módulos siguen hablando con él y no con el broker.
- `modules/email/`: `EmailNotificador` manda con NodeMailer. Cada mail queda en
  `envio_notificacion` (PENDIENTE, ENVIADO o FALLIDO), y un reintento no repite
  los que ya salieron.
- `modules/bandeja/`: `BandejaNotificaciones` guarda cada evento en la tabla
  `notificacion` de cada destinatario (los mismos que el mail, se lea o no el
  mail), con la marca en `evento_procesado`. Es lo que leen la campana y el
  centro de notificaciones:

  | Método | Ruta | Quién |
  |---|---|---|
  | GET | `/notificaciones` | con sesión: las propias, con `noLeidas` (`?soloNoLeidas=`, `pagina`, `limite`) |
  | PATCH | `/notificaciones/:id/leida` | la propia; ajena, 404 |
  | POST | `/notificaciones/leer-todas` | con sesión |
- `modules/novedades/`: `MuroNovedadesPublicador`. La novedad se guarda junto con
  la marca en `evento_procesado`, así un evento repetido no la duplica.

### Reintentos y DLQ

Cada consumidor tiene tres colas: la principal, `.reintento` (TTL de 30 s que
devuelve el mensaje a la principal) y `.dlq`. El ack es manual: si el handler
falla, el mensaje vuelve hasta 3 veces y después queda en la DLQ para mirarlo a
mano. Un sobre que no cumple el contrato va directo a la DLQ.

### Configurar

En `apps/backend/.env` (ver `.env.example`):

- `RABBITMQ_URL`: el grupo usa **CloudAMQP** (plan gratis), con la "AMQP URL"
  del panel. Para un broker propio, `docker compose up -d rabbitmq` en la raíz
  del repo levanta uno con panel en `http://localhost:15672`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `MAIL_FROM`: en desarrollo,
  **Mailtrap** (Email Testing → Inbox → SMTP). Los mails quedan en la bandeja de
  prueba y no le llegan a nadie.

Sin `RABBITMQ_URL` los eventos quedan en el log; sin `SMTP_HOST`, los mails. La
app anda igual en los dos casos. Si todos usan el mismo CloudAMQP, los backends
de cada uno compiten por las mismas colas; como la base también es compartida,
no importa quién procese cada mensaje.

### Pendiente

- Si el broker está caído y el proceso se reinicia antes de reconectar, los
  eventos que retenía en memoria se pierden. Lo robusto es una tabla outbox.
- **Preferencias.** El mail respeta `preferencia_notificacion`: quien apagó
  `EMAIL` para una categoría no recibe esos avisos. La categoría sale del tipo
  de evento o, en un `aviso.directo`, del prefijo de su `origen`
  (`core/notificaciones/categorias.ts`): `boleta:` es VENCIMIENTOS, `pago:`
  BOLETAS, `reclamo:` y `reserva:` RECLAMOS_RESERVAS. Un origen sin categoría
  (el aviso de cobro duplicado al administrador) sale siempre. Sin fila
  guardada, todo está habilitado. WhatsApp y push se guardan pero todavía no
  envían nada (`disponible: false`).

## Datos de demo

```bash
pnpm back db:seed-demo
```

Crea o completa el consorcio Av. Rivadavia 4820 con 48 departamentos (12 pisos
de A a D), sus vecinos, 3 proveedores y 3 reclamos. Incluye una liquidación
emitida de septiembre de 2026, boletas pagadas, parciales y vencidas, SUM y
parrilla con reservas, una asamblea convocada con votación anticipada y
novedades. Los coeficientes suman 100%; conserva los de las unidades existentes.

Por defecto **simula la carga y revierte la transacción**. Para guardar los datos
en la **base compartida**, avisar al grupo y ejecutar:

```bash
pnpm back db:seed-demo --aplicar
```

Es idempotente: conserva las filas existentes y no publica eventos ni envía correos.
Si encuentra unidades ajenas al demo, otro administrador o una liquidación
ajena al seed en ese período, aborta y revierte toda la carga.

Para agregar un consorcio independiente por integrante, pasar `--personas`
con un archivo JSON local (la clave debe ser única, de 1 a 7 letras minúsculas,
números o guiones; el email de demo debe ser único y terminar en `@domus.test`):

```json
[{ "clave": "nacho", "nombre": "Ignacio", "apellido": "Alcaraz", "email": "admin.nacho@domus.test" }]
```

```bash
pnpm back db:seed-demo --personas ./personas.local.json
pnpm back db:seed-demo --personas ./personas.local.json --aplicar
pnpm back db:seed-demo --personas ./personas.local.json --verificar
```

Cada persona recibe el consorcio `Demo <clave>` y 48 vecinos con email
`vecino+<clave>-<numero>@domus.test` (numerados por piso de 1º A a 12º D).
El edificio original y sus cuentas se mantienen para las pruebas comunes.
`--verificar` repite la carga en la misma transacción y comprueba que no se
dupliquen filas; sin `--aplicar` también revierte toda la prueba.

| Usuario             | Rol           | Unidad |
|---------------------|---------------|--------|
| `admin@domus.test`  | ADMINISTRADOR | —      |
| `vecino@domus.test` | VECINO        | 3º B   |
| `vecina2@domus.test`| VECINO        | 6º B   |
| `vecino3@domus.test`| VECINO        | 2º A   |

La password de todos es `Domus.2026`.

Además del seed existe `superadmin@domus.app` (rol `SUPER_ADMIN`, misma
password), creado por CLI para el panel de la plataforma. También hay un
administrador de prueba sin consorcio, `julian.sosa@domus.test`, útil para
probar la asignación.
