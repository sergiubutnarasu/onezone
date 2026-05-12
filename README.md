# Onezone

Onezone is an AI agent orchestration platform that lets you manage and dispatch coding agents (Claude Code, GitHub Copilot CLI) from a central web UI. Agents run inside local terminal processes, pick up tasks over WebSockets, and report progress in real time.

## Architecture

This is a **pnpm monorepo** powered by [Turborepo](https://turbo.build/).

```
onezone/
├── apps/
│   ├── server/     # NestJS API + WebSocket gateway (port 5026)
│   ├── web/        # Next.js dashboard UI (port 5025)
│   └── terminal/   # oclif CLI — registers a terminal and runs agent tasks
└── packages/
    ├── shared/     # Shared TypeScript types, Zod schemas, and Socket.io event enums
    └── tsconfig/   # Base TypeScript configuration
```

## Prerequisites

- Node.js ≥ 22
- pnpm ≥ 9
- Docker & Docker Compose (for local infrastructure)

## Quick Start

### 1. Start infrastructure

```bash
docker compose up postgres redis -d
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

Copy `.env.example` to `.env` in `apps/server/` and set:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://onezone:onezone@localhost:5432/onezone` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `CORS_ORIGIN` | `http://localhost:5025` | Allowed CORS origin |

### 4. Run database migrations

```bash
cd apps/server
pnpm prisma migrate deploy
pnpm prisma db seed
```

### 5. Start all services

```bash
pnpm dev
```

The web UI will be available at [http://localhost:5025](http://localhost:5025) and the API at [http://localhost:5026](http://localhost:5026).

## Docker (Full Stack)

```bash
docker compose up --build
```

## Monorepo Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in watch mode |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm clean` | Remove all build artifacts |

## Packages

| Package | Description |
|---|---|
| [`apps/server`](apps/server/README.md) | NestJS backend — REST API, WebSocket gateway, Prisma ORM |
| [`apps/web`](apps/web/README.md) | Next.js frontend — project dashboard, kanban board, live agent chat |
| [`apps/terminal`](apps/terminal/README.md) | oclif CLI — registers terminals and dispatches agent tasks |
| [`packages/shared`](packages/shared/README.md) | Shared types, schemas, and Socket.io event constants |



```
COPILOT_PROVIDER_BASE_URL=http://localhost:11434/v1 COPILOT_PROVIDER_API_KEY= COPILOT_PROVIDER_WIRE_API=responses COPILOT_MODEL=gemma4:31b-cloud copilot --yolo -p "Check your permission on the current directory"

COPILOT_PROVIDER_BASE_URL=http://localhost:11434/v1 COPILOT_PROVIDER_API_KEY= COPILOT_PROVIDER_WIRE_API=responses COPILOT_MODEL=gemma4:31b-cloud copilot --yolo -p "Create test folder"

COPILOT_PROVIDER_BASE_URL=http://localhost:11434/v1 COPILOT_PROVIDER_API_KEY= COPILOT_PROVIDER_WIRE_API=responses COPILOT_MODEL=gemma4:31b-cloud copilot -p "What's you current user and permissions"

ANTHROPIC_AUTH_TOKEN=ollama ANTHROPIC_BASE_URL=http://localhost:11434 ANTHROPIC_API_KEY="" claude --model gemma4:31b-cloud --dangerously-skip-permissions -p "run: mkdir test && echo 'Created test folder' && ls -la"

ANTHROPIC_AUTH_TOKEN=ollama ANTHROPIC_BASE_URL=http://localhost:11434 ANTHROPIC_API_KEY="" claude --model kimi-k2.6:cloud --dangerously-skip-permissions -p "run: mkdir test && echo 'Created test folder' && ls -la"
```