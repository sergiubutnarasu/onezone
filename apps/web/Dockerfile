FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# ---- Install deps & build ----
FROM base AS builder
WORKDIR /app

# NEXT_PUBLIC_* vars are baked in at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:5026
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Copy manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY apps/web/ apps/web/

# Build shared, then web
RUN pnpm --filter=@onezone/shared build
RUN pnpm --filter=web build

# ---- Production image ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# standalone output mirrors monorepo layout (outputFileTracingRoot set to repo root)
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 5025
ENV PORT=5025
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
