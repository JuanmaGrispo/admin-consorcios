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
(o por `POST /usuarios`).

### Endpoints

| Método | Ruta           | Quién puede                          |
|--------|----------------|--------------------------------------|
| POST   | `/auth/login`  | cualquiera — deja la cookie de sesión |
| POST   | `/auth/logout` | cualquiera — borra la cookie          |
| GET    | `/auth/me`     | con sesión (cookie o bearer)          |
| GET    | `/usuarios`    | superadmin (filtro `?rol=`)           |
| POST   | `/usuarios`    | superadmin (crea ADMINISTRADOR/VECINO)|

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
referencia: leer es para cualquier usuario logueado, crear/editar/borrar es del
superadmin.

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
  `consorcioId`. Filtrar por consorcio devuelve los suyos más los compartidos.

### Unidades

| Método | Ruta                                  | Quién |
|--------|---------------------------------------|-------|
| GET    | `/unidades`                           | admin: todas · vecino: las suyas |
| GET    | `/unidades/:id`                       | admin: cualquiera · vecino: sólo las suyas (404 si no) |
| POST   | `/unidades`                           | administrador |
| PATCH  | `/unidades/:id`                       | administrador (`activa: false` la da de baja) |
| GET    | `/unidades/:id/vinculos`              | administrador |
| POST   | `/unidades/:id/vinculos`              | administrador: vincula un vecino |
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
| GET    | `/reclamos`               | admin: todos · vecino: los de sus unidades |
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
- Donde dice "administrador" vale también para el **superadmin**: ve todos los
  reclamos, las notas internas y puede gestionarlos.

### Línea de tiempo

Cada movimiento deja un `reclamo_evento`: `CREACION`, `ASIGNACION`,
`CAMBIO_ESTADO`, `RESPUESTA` y `NOTA_INTERNA`. Las notas internas
(`visible_para_vecino = false`) sólo las escribe el administrador y sólo él las
ve: al vecino se le devuelve la timeline recortada.

### Fotos

La API recibe URLs ya subidas (`adjuntos: [{ url, nombre }]`), no archivos. No
hay bucket de Storage creado todavía; cuando se defina dónde viven las imágenes,
se suma el upload sin tocar la lógica del módulo.

### Avisos

El service llama a `Notificador` (`core/notificaciones/`), que por ahora sólo
deja registro en el log. Cuando exista el módulo de notificaciones con
NodeMailer detrás, implementa esa misma interfaz y reclamos no se toca. Avisar
nunca corta la operación: si el aviso falla, la respuesta ya quedó guardada.

El diseño de ese módulo (eventos de dominio publicados en RabbitMQ y
consumidos por email y el muro de novedades) está en
[`docs/mensajeria.md`](docs/mensajeria.md).

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
| GET    | `/boletas`                                  | admin: todas · vecino: las emitidas de sus unidades |
| GET    | `/boletas/:id`                              | con el detalle línea por línea; al vecino, 404 si no es suya o no se emitió |
| PATCH  | `/boletas/:id/ajuste`                       | administrador, sólo en previsualización |
| GET    | `/rubros-gasto`                             | cualquier logueado (`?consorcioId=`: los suyos más los compartidos) |
| POST · PATCH · DELETE | `/rubros-gasto[/:id]`        | administrador (compartido: superadmin); 409 al borrar uno con gastos |

Filtros de `GET /boletas`: `liquidacionId`, `unidadId`, `estado`.

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
- **Ajuste manual.** Positivo suma, negativo descuenta y 0 lo quita. Lleva
  motivo obligatorio, porque el vecino lo ve en la boleta, y no puede dejar el
  total negativo.
- **Rubros.** Tienen la misma lógica que las categorías de reclamo:
  compartidos (sólo superadmin) o por consorcio, sin nombres repetidos en la
  misma lista, y no se borran si tienen gastos. Cambiar la naturaleza de un
  rubro no toca los gastos ya cargados.

### Avisos al emitir

Cada vecino vinculado hoy a cada unidad recibe un aviso con el total y el
vencimiento, por el mismo `Notificador` que usa reclamos. Si un aviso falla,
queda en el log y la emisión sigue.

### Pendiente

- **Pagos.** El estado de la boleta (`PENDIENTE` → `PARCIAL` / `PAGADA` /
  `VENCIDA`) lo va a mover el módulo de pagos. La deuda ya descuenta los pagos
  `APROBADO` de la tabla `pago`.
- **PDF de la boleta** (`pdf_url`) y marca de envío (`enviada_at`).
- **Vínculo de un gasto con una votación o un reclamo** (`votacion_id`,
  `reclamo_id`): las columnas existen, pero la API todavía no las carga.

## Datos de demo

```bash
pnpm back db:seed-demo
```

Crea un consorcio (Av. Rivadavia 4820) con 3 unidades, sus vecinos, 3
proveedores y 3 reclamos en distintos estados. Es idempotente: se puede correr
las veces que haga falta. **Escribe en la base compartida**, así que conviene
avisar al grupo.

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
