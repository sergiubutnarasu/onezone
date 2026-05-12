# @onezone/server

The NestJS backend for OneZone. Provides a REST API and a Socket.io WebSocket gateway backed by Redis for real-time communication with web clients and terminal agents.

## Stack

- **NestJS** — framework
- **Prisma** — ORM with PostgreSQL
- **Socket.io** — real-time events (Redis adapter for horizontal scaling)
- **class-validator / class-transformer** — request validation

## Modules

| Module | Responsibility |
|---|---|
| `ProjectsModule` | CRUD for projects and kanban columns |
| `TasksModule` | CRUD for tasks; task lifecycle management |
| `MessagesModule` | Persisting and querying chat/command messages |
| `GatewaysModule` | Socket.io gateway — routes events between terminals and the web UI |
| `TerminalsModule` | Terminal registration and tracking |
| `AgentsModule` | Agent registry (Claude Code, Copilot CLI) |
| `PrismaModule` | Global database client |
| `TerminalRegistryModule` | In-memory registry of connected terminal sockets |

## Development

```bash
# From repo root — start postgres + redis
docker compose up postgres redis -d

# Install deps (from repo root)
pnpm install

# Run migrations
pnpm prisma migrate deploy
pnpm prisma db seed

# Start in watch mode
pnpm dev
```

The server listens on **port 5026** by default.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `REDIS_URL` | `redis://localhost:6379` | Redis URL for Socket.io adapter |
| `CORS_ORIGIN` | `http://localhost:5025` | Allowed CORS origin for the web UI |
| `PORT` | `5026` | HTTP/WebSocket port |

## Database

Prisma schema is located at `prisma/schema.prisma`. Key models:

- **Agent** — registered AI agents (Claude Code, Copilot CLI) with their model names
- **Project** — top-level workspace; owns tasks, kanban columns, and skills
- **KanbanColumn** — ordered board columns with AI instructions per column
- **Task** — unit of work assigned to a terminal and agent
- **Message** — chat messages and command output attached to a task
- **Terminal** — registered CLI terminal sessions

### Migration commands

```bash
# Create a new migration
pnpm prisma migrate dev --name <migration-name>

# Apply all pending migrations
pnpm prisma migrate deploy

# Open Prisma Studio
pnpm prisma studio
```

## Build & Production

```bash
pnpm build          # compiles TypeScript via nest build
pnpm start          # runs dist/main.js
```
