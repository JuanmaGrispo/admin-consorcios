# syntax=docker/dockerfile:1
#
# Imagen del backend (NestJS). Se construye desde la RAÍZ del monorepo, porque
# necesita el pnpm-lock.yaml y el pnpm-workspace.yaml:
#
#   docker build -f apps/backend/Dockerfile .
#
# Normalmente no hace falta: `docker compose up --build` lo hace solo.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# ── Build ────────────────────────────────────────────────────────────────────
FROM base AS build
# Primero solo los manifiestos: si no cambian, Docker reusa la capa del install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter backend-consorcios...

COPY apps/backend apps/backend
RUN pnpm --filter backend-consorcios build

# Carpeta autocontenida con dist/ y solo las dependencias de producción.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter backend-consorcios deploy --prod /prod/backend

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000
COPY --from=build --chown=node:node /prod/backend ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+(process.env.API_GLOBAL_PREFIX||'/api')+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
