# syntax=docker/dockerfile:1
#
# Imagen del frontend (Next.js, build standalone). Se construye desde la RAÍZ
# del monorepo:
#
#   docker build -f apps/frontend/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000/api .
#
# OJO: NEXT_PUBLIC_API_URL queda horneada en el build (la usa el navegador), así
# que si cambia hay que reconstruir la imagen.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# ── Build ────────────────────────────────────────────────────────────────────
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter frontend-consorcios...

COPY apps/frontend apps/frontend
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter frontend-consorcios build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# El standalone replica la estructura del monorepo: el server queda en
# apps/frontend/server.js. Los estáticos y public/ no vienen incluidos.
COPY --from=build --chown=node:node /repo/apps/frontend/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build --chown=node:node /repo/apps/frontend/public ./apps/frontend/public
USER node
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
