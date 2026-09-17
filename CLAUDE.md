# admin-consorcios — Domus

Sistema de administración de consorcios. TP de Desarrollo de Aplicaciones 2
(UADE). Monorepo pnpm: `apps/backend` (NestJS 11 + TypeORM + Postgres en
Supabase) y `apps/frontend` (Next.js 16 + shadcn/ui + Tailwind 4).

El README tiene el arranque, la arquitectura y el detalle de cada módulo. Este
archivo tiene las reglas que no se negocian y que un agente o un compañero
nuevo tiene que saber antes de tocar código.

## Reglas del repo

- **Español** en documentación, comentarios, nombres de dominio (`consorcio`,
  `reclamo`, `unidad`). **Inglés** en lo técnico (`service`, `repository`,
  `findAll`).
- **La base es la fuente de verdad.** Las entities de `apps/backend/src/database/entities/`
  se **generan** desde Supabase (`pnpm back db:generate-entities`), nunca se
  editan a mano. Un cambio de esquema que nace del código va como migración
  en `src/database/migrations/` y después se regenera. `pnpm back db:verify`
  tiene que pasar antes de commitear.
- **Backend por capas, módulos planos.** Cada módulo en `src/modules/<nombre>/`
  con `module`, `controller`, `service`, `repository` (si tiene db) y `client`
  (si consume API externa). El controller habla con el service, el service con
  el repository. Nadie hace fetch ni SQL por afuera.
- **Todo endpoint nace protegido.** El guard de JWT es global; abrir una ruta
  es `@Public()` explícito. Permisos por rol con `@Roles()`. La jerarquía
  (`SUPER_ADMIN` pasa todo) vive en `RolesGuard`, no en la base.
- **Sesión web = cookie httpOnly.** El frontend nunca toca el token.
- **Flujo git:** branch desde `develop` → PR a `develop` → `develop` a `main`
  cuando hay algo estable. Push directo a `main` y `develop` está bloqueado.
- **Commits atómicos** con mensaje que explique el porqué, no el qué.
- **Nunca** credenciales en el código ni en PRs: van en `.env` (gitignoreado).

## Frontend

Todo lo de UI está en [apps/frontend/CLAUDE.md](apps/frontend/CLAUDE.md):
shadcn/ui obligatorio, tokens del design system Domus, paleta, responsive.
Leelo antes de crear o tocar cualquier componente.
