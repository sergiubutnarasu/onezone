FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# ---- Install deps ----
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY apps/server/package.json apps/server/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY apps/server/ apps/server/

# Build shared, generate Prisma client, build server
RUN pnpm --filter=@onezone/shared build
RUN pnpm --filter=@onezone/server exec prisma generate
RUN pnpm --filter=@onezone/server build

# Create a self-contained production deployment
RUN pnpm deploy --filter=@onezone/server --prod /deploy

# Run prisma generate inside the deployed directory (prisma is a prod dep)
RUN cd /deploy && node_modules/.bin/prisma generate

# ---- Production image ----
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=builder /deploy ./

EXPOSE 5026
# Apply pending migrations and seed reference data (agents) before starting.
# `prisma db seed` reads the "prisma.seed" script from package.json.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node_modules/.bin/prisma db seed && node dist/main"]
