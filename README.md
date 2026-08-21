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

Capas, de afuera hacia adentro. La regla: cada capa solo conoce a la de abajo.

| Capa | Qué hace | Qué NO hace |
|---|---|---|
| `controllers` | HTTP: rutas, DTOs, validación | Lógica de negocio |
| `services` | Reglas de negocio | Hablar HTTP o SQL |
| `repositories` | Acceso a datos (TypeORM) | Decidir negocio |
| `clients` | APIs externas | Filtrar al resto del código |

Cada módulo de negocio vive en `src/modules/<nombre>/` con sus capas adentro.
`src/modules/consorcios/` es el ejemplo de referencia: copiá esa forma para
cada módulo nuevo. Lo transversal (health, auth futura) va en `src/core/`.

## Base de datos

En desarrollo, `DB_SYNC=true` sincroniza el esquema con las entidades al
levantar. Para producción existen migraciones:

```bash
pnpm back migration:generate src/database/migrations/NombreDelCambio
pnpm back migration:run
```
