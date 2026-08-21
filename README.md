# admin-consorcios

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
- PostgreSQL corriendo local (o Docker: ver abajo)

## Arranque

```bash
pnpm install

# Variables de entorno (una vez)
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# Base de datos rápida con Docker
docker run -d --name pg-consorcios -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=admin_consorcios -p 5432:5432 postgres:16

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

## Base de datos

En desarrollo, `DB_SYNC=true` sincroniza el esquema con las entidades al
levantar. Para producción existen migraciones:

```bash
pnpm back migration:generate src/database/migrations/NombreDelCambio
pnpm back migration:run
```
