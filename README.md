# admin-consorcios

Integrantes: Ignacio Alcaraz, Patricio Vecino, Juanmanuel Grispo, Felipe Vega Torre, Martin Capece y Jose Garcia Olmos.
Sistema de administración de consorcios. TP de Desarrollo de Aplicaciones 2 (UADE).

Monorepo pnpm con dos apps:

```
apps/
├── backend/    NestJS 11 + TypeORM + PostgreSQL   → :4000  (docs en /docs)
└── frontend/   Next.js 16 + Tailwind 4            → :3000
```

Domus permite gestionar consorcios, unidades y vecinos, liquidar y cobrar
expensas, atender reclamos, reservar amenities y organizar asambleas y votaciones.

## Cómo levantar el proyecto

### Rápido: todo el sistema con un comando

Requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto. No hace falta Node, ni un `.env`, ni cuentas de terceros.

```bash
git clone https://github.com/JuanmaGrispo/admin-consorcios.git
cd admin-consorcios
docker compose up --build
```

La primera vez tarda unos minutos en construir las imágenes. Levanta, todo en contenedores:

| Servicio | Qué es | Dirección |
|---|---|---|
| `frontend` | Next.js | http://localhost:3000 |
| `backend` | NestJS (Swagger en `/docs`) | http://localhost:4000/api |
| `postgres` | PostgreSQL 17 con el esquema, las migraciones y los datos de demo | interno |
| `rabbitmq` | Broker de mensajería | panel en http://localhost:15672 |
| `simuladores` | Mercado Pago, Storage y SMTP simulados | mails enviados en http://localhost:4010/correos |
| `inicializador` | Prepara la base y los secretos locales, y termina | — |

**Entrar.** El entorno local genera cuentas de demostración durante la inicialización. Los datos de acceso se consultan con:

```bash
docker compose logs inicializador
```

Para acceder al entorno compartido, solicitar acceso al equipo.

| Para… | Comando |
|---|---|
| Frenarlo | `Ctrl+C` |
| Dejarlo corriendo de fondo | `docker compose up -d --build` |
| Ver los logs | `docker compose logs -f backend` |
| Apagar y prender el broker (prueba de resiliencia) | `docker compose stop rabbitmq` / `docker compose start rabbitmq` |
| Bajarlo | `docker compose down` |
| Empezar de cero (borra base, archivos y secretos) | `docker compose down -v` |

Detalles:

- El backend corre con `NODE_ENV=development` (Swagger prendido, cookie sin `Secure`). Para probarlo como en producción: `NODE_ENV=production docker compose up --build`.
- Las migraciones nuevas se aplican solas en cada arranque. El seed sólo corre con la base vacía.
- Después de un `git pull` o de tocar código, volver a correr con `--build`.

### Contra la base compartida de Supabase (grupo)

Para trabajar con Supabase, CloudAMQP, Mailtrap y Mercado Pago de prueba, como antes, primero hay que armar el `.env`:

```bash
cp apps/backend/.env.example apps/backend/.env
```

En `apps/backend/.env` hay que completar dos variables, el resto es opcional:

| Variable | Obligatoria | De dónde sale |
|---|---|---|
| `DATABASE_URL` | Sí | Supabase → Connect → URI del **Session pooler** (puerto 5432). Ver [Base de datos](docs/referencia-tecnica.md#base-de-datos) |
| `JWT_SECRET` | Sí | Uno propio: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `SEED_PASSWORD` | Para el seed | Configuración privada del seed; ver `.env.example` |
| `RABBITMQ_URL`, `SMTP_*`, `MP_*`, `SUPABASE_*` | No | Sin ellas, mails, pagos online y archivos quedan apagados y el resto anda igual |

El `.env` está en el `.gitignore`: nunca se commitea. Con Docker:

```bash
docker compose -f docker-compose.yml -f docker-compose.supabase.yml up --build
```

Las migraciones contra Supabase **no** corren solas (la base es compartida): se corren a mano con `pnpm back migration:run`.

### Con pnpm (desarrollo, contra Supabase)

Requisitos: Node >= 22 y pnpm 9 (`corepack enable` lo activa).

```bash
pnpm install
cp apps/frontend/.env.example apps/frontend/.env

pnpm back db:check   # verifica la conexión: imprime la base y las tablas que ve
pnpm dev             # backend (:4000) y frontend (:3000) juntos, con recarga
```

Atajos: `pnpm back <script>` y `pnpm front <script>` corren scripts de cada app
(ej: `pnpm back dev`, `pnpm front build`).

## Arquitectura y reglas principales

- **Backend:** NestJS, TypeORM y PostgreSQL. Cada módulo separa controller,
  service y repository; las integraciones externas usan un client.
- **Frontend:** Next.js, shadcn/ui y Tailwind, con el diseño Domus.
- **Sesión:** cookie httpOnly. Los endpoints requieren JWT salvo rutas públicas
  explícitas; los permisos distinguen superadministrador, administrador y vecino.
- **Base de datos:** las entidades se generan desde la base y no se editan a mano.
  Los cambios de esquema versionados van como migraciones; después se regeneran
  las entidades con `pnpm back db:generate-entities`.
- **Notificaciones:** eventos de dominio por RabbitMQ para email y avisos internos.

## Comandos de desarrollo

| Para… | Comando |
|---|---|
| Ejecutar los tests del backend | `pnpm back test` |
| Verificar tipos | `pnpm typecheck` |
| Compilar las apps | `pnpm build` |
| Comprobar entidades contra la base antes de commitear | `pnpm back db:verify` |

## Si algo falla

| Síntoma | Revisar |
|---|---|
| No conecta a Supabase | `DATABASE_URL`, contraseña codificada en la URI y Session pooler en puerto 5432 |
| El login no responde | Estado del backend: `docker compose logs backend` |
| Puerto ocupado | Otro proceso usando 3000 o 4000 |
| Docker no refleja los cambios | Volver a ejecutar con `--build` |

## Documentación

| Documento | Contenido |
|---|---|
| [API interactiva](http://localhost:4000/docs) | Endpoints y contratos; requiere el backend local en desarrollo |
| [Referencia técnica](docs/referencia-tecnica.md) | Base de datos, autenticación, módulos y reglas de negocio |
| [Producto](docs/producto.md) | Visión y alcance funcional |
| [Prototipo del frontend](docs/diseno-front.html) | Pantallas y flujos de referencia |
| [Reglas del repositorio](AGENTS.md) | Convenciones para contribuir |
| [Reglas de UI](apps/frontend/CLAUDE.md) | Componentes y design system |
| [Mensajería](docs/mensajeria.md) | Eventos, consumidores y topología RabbitMQ |
| [CI](docs/ci.md) | Validaciones automatizadas |
| [Operación y resiliencia](docs/operacion-resiliencia.md) | Procedimientos de diagnóstico y recuperación |
