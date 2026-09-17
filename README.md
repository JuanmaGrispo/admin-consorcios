# admin-consorcios

Integrantes: Ignacio Alcaraz, Patricio Vecino, Juanmanuel Grispo, Felipe Vega Torre, Martin Capece
Sistema de administración de consorcios. TP de Desarrollo de Aplicaciones 2 (UADE).

Monorepo pnpm con dos apps:

```
apps/
├── backend/    NestJS 11 + TypeORM + PostgreSQL   → :4000  (docs en /docs)
└── frontend/   Next.js 16 + Tailwind 4            → :3000
```

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

Por eso **no hay `DB_SYNC` ni migraciones de TypeORM**: `synchronize` está fijo
en `false`. Si TypeORM pudiera escribir DDL, una entidad desactualizada
alteraría las tablas del grupo para que coincidan con el código — justo al
revés de lo que queremos.

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

### Crear el primer usuario

No hay endpoint de registro — dejarlo abierto permitiría que cualquiera se dé de
alta como administrador. Los usuarios se crean por CLI:

```bash
pnpm back usuario:crear <email> <password> [ADMINISTRADOR|VECINO] [nombre] [apellido]
```

### Endpoints

| Método | Ruta         | Quién puede            |
|--------|--------------|------------------------|
| POST   | `/auth/login`| cualquiera             |
| GET    | `/auth/me`   | con token              |

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
referencia: leer es para cualquier usuario, crear/editar/borrar es de
administradores.

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
