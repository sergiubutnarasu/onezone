# Onezone

Onezone is a production-minded AI agent orchestration platform for running coding agents from a central web workspace. It combines a Next.js dashboard, a NestJS API, a Socket.io real-time layer, and a terminal worker CLI so users can create projects, assign tasks, stream command output, monitor cost, and move work through kanban-style automation.

## What You Get

- Project workspaces with kanban columns, backlog, completion state, project import/export, and project-level skills.
- Task assignment to connected terminals with real-time chat, stdout/stderr streaming, command lifecycle events, and stop signals.
- Agent registry for Claude Code, GitHub Copilot CLI, and Opencode style runners, with global defaults and per-user model overrides.
- Project memory backed by S3-compatible storage for key-value reads and writes scoped to each project.
- Scheduled tasks powered by cron expressions, time zones, optional one-shot runs, and terminal/agent/model selection.
- Authentication with email/password, HTTP-only cookies, JWT access tokens, refresh tokens, and CLI device-code login.
- Notifications for command starts, command exits, failures, and completed tasks.
- Usage statistics for tasks, command outcomes, token counts, and estimated project costs.
- Shared TypeScript contracts and Zod schemas used across the server, web app, and terminal CLI.

## Pros

- **Bring your own terminals**: run agents on your laptop, a workstation, a Docker worker, or a remote runner while managing them from one UI.
- **Real-time by default**: Socket.io events keep the board, task chat, terminal state, notifications, and command output live.
- **Multi-user ready**: projects, tasks, terminals, messages, notifications, skills, schedules, and agent settings are scoped by user.
- **Production-shaped stack**: PostgreSQL persistence, Redis-backed WebSockets, Prisma migrations, Docker images, health checks, and explicit environment configuration.
- **Agent flexible**: Claude Code and Github Copilot CLI are first-class, and model values are configurable globally, per user, per task, per column, and per schedule where supported.
- **Automation friendly**: recurring schedules and kanban column instructions let users turn repeated development workflows into repeatable agent runs.
- **Type-safe contracts**: shared enums, payload types, room helpers, constants, and validation schemas reduce drift between packages.

## Architecture

This repository is a pnpm and Turborepo monorepo.

```text
onezone/
|-- apps/
|   |-- server/     # NestJS REST API, auth, Prisma, schedules, Socket.io gateway on port 5026
|   |-- web/        # Next.js dashboard UI on port 5025
|   `-- terminal/   # oclif CLI that registers terminals and executes assigned agent tasks
`-- packages/
    |-- shared/     # Shared TypeScript types, Zod schemas, constants, and Socket.io event contracts
    `-- tsconfig/   # Shared TypeScript configuration
```

Runtime services:

| Service | Default port | Purpose |
|---|---:|---|
| Web | `5025` | Browser UI for projects, tasks, terminals, agents, schedules, notifications, and statistics |
| Server | `5026` | REST API, auth, WebSocket gateway, schedule runner, and health endpoint |
| PostgreSQL | `5432` | Persistent application data through Prisma |
| Redis | `6379` | Socket.io Redis adapter for real-time fan-out and horizontal scaling |
| Terminal worker | n/a | Authenticates with the server, listens for assignments, and runs agent CLIs |

## Prerequisites

- Node.js `>=22.0.0`
- pnpm `>=9.0.0` (`packageManager` is `pnpm@9.12.0`)
- Docker and Docker Compose for local infrastructure or the full stack
- Agent provider credentials (ANTHROPIC_* for Claude, COPILOT_* for GitHub Copilot) configured in your .env

## Quick Start Options

### Option 1: Full Stack With Docker Compose

Use this when you want the web app, API, database, Redis, and terminal worker to run as containers.

Create a root `.env` file from the environment table below. At minimum, set `JWT_SECRET` for any non-throwaway environment, then start the stack.

```bash
docker compose up --build
```

Open the app at [http://localhost:5025](http://localhost:5025). The API health check is [http://localhost:5026/health](http://localhost:5026/health).

### Option 2: Local Development With Docker Infrastructure

Use this when you want fast app reloads but still want Postgres and Redis from Docker.

```bash
docker compose up postgres redis -d
pnpm install
pnpm --filter @onezone/server exec prisma migrate deploy
pnpm --filter @onezone/server exec prisma db seed
pnpm dev
```

The web app runs on [http://localhost:5025](http://localhost:5025), and the server runs on [http://localhost:5026](http://localhost:5026).

### Option 3: Run A Local Terminal Worker

Start the web and server first, then authenticate the terminal CLI and let it listen for work.

```bash
pnpm build
pnpm --filter @onezone/terminal dev login --server http://localhost:5026
pnpm --filter @onezone/terminal dev listen --server http://localhost:5026 --name local-dev
```

The login command uses the device-code flow. It prints a user code, opens through the web activation page, and stores tokens in the OS keychain with a file fallback at `~/.onezone/tokens.json` for environments without a secret service.

### Option 4: Use The Published Terminal CLI

Use this when the server is already deployed and you only need to connect a machine as a runner.

```bash
npm install -g @onezone/terminal
onezone-terminal login --server https://your-onezone-api.example.com
onezone-terminal listen --server https://your-onezone-api.example.com --name workstation-1
```

## Environment Variables

Root Docker Compose reads variables from `.env`. Individual apps can also read their own local environment when run outside Compose.

| Variable | Used by | Default | Required | Description |
|---|---|---|---|---|
| `POSTGRES_DB` | Compose Postgres | `onezone` | No | Database name for local Compose |
| `POSTGRES_USER` | Compose Postgres | `onezone` | No | Database user for local Compose |
| `POSTGRES_PASSWORD` | Compose Postgres | `onezone` | No | Database password for local Compose |
| `DATABASE_URL` | Server | Compose builds one from Postgres values | Yes | PostgreSQL connection string |
| `REDIS_URL` | Server | `redis://localhost:6379` locally, `redis://redis:6379` in Compose | Yes | Redis URL for the Socket.io adapter |
| `WEB_ORIGINS` | Server | `http://localhost:5025` | Yes | Comma-separated allowed origins for CORS, cookies, and CLI device activation URLs |
| `PORT` | Server | `5026` | No | Server HTTP and WebSocket port |
| `JWT_SECRET` | Server | none | Yes | Secret used to sign access tokens. Set a strong value in every environment. |
| `JWT_EXPIRES_IN` | Server | `15m` | No | Access token lifetime. Supports values such as `15m`, `1h`, or `1d`. |
| `REFRESH_TOKEN_EXPIRES_IN` | Server | `30d` | No | Refresh token lifetime in days, such as `30d`. |
| `ADMIN_EMAILS` | Server | empty | No | Comma-separated list of emails treated as admins. |
| `NEXT_PUBLIC_API_URL` | Web | `http://localhost:5026` | Yes | Browser-visible API and Socket.io server URL. |
| `TERMINAL_NAME` | Docker terminal | `Onezone Docker Terminal` | No | Name registered by the bundled terminal worker container. |
| `TERMINAL_SERVER_URL` | Docker terminal | `http://server:5026` | No | Server URL used by the bundled terminal worker container. |
| `ANTHROPIC_AUTH_TOKEN` | Terminal agent runtime | none | Depends on runner | Optional Claude-compatible auth token for agent execution. |
| `ANTHROPIC_BASE_URL` | Terminal agent runtime | none | No | Optional Claude-compatible API base URL. |
| `ANTHROPIC_API_KEY` | Terminal agent runtime | none | Depends on runner | Optional Claude-compatible API key. |
| `COPILOT_GITHUB_TOKEN` | Terminal agent runtime | none | Depends on runner | Optional GitHub token for Copilot CLI authentication. |
| `COPILOT_PROVIDER_BASE_URL` | Terminal agent runtime | none | No | Optional custom model provider base URL for Copilot CLI. |
| `COPILOT_PROVIDER_API_KEY` | Terminal agent runtime | none | No | Optional custom model provider API key for Copilot CLI. |
| `COPILOT_PROVIDER_TYPE` | Terminal agent runtime | none | No | Optional custom model provider type for Copilot CLI (`openai`, `azure`, `anthropic`). |
| `S3_ENDPOINT` | Server | none | Yes | S3-compatible endpoint for project memory storage |
| `S3_ACCESS_KEY_ID` | Server | none | Yes | S3 access key for project memory storage |
| `S3_SECRET_ACCESS_KEY` | Server | none | Yes | S3 secret key for project memory storage |

Example local `.env`:

```dotenv
POSTGRES_DB=onezone
POSTGRES_USER=onezone
POSTGRES_PASSWORD=onezone
DATABASE_URL=postgresql://onezone:onezone@localhost:5432/onezone
REDIS_URL=redis://localhost:6379
WEB_ORIGINS=http://localhost:5025
NEXT_PUBLIC_API_URL=http://localhost:5026
JWT_SECRET=replace-with-a-long-random-secret
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minio
S3_SECRET_ACCESS_KEY=minio123
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d
ADMIN_EMAILS=admin@example.com
```

## Database

Prisma schema and migrations live in `apps/server/prisma`.

```bash
pnpm --filter @onezone/server exec prisma migrate deploy
pnpm --filter @onezone/server exec prisma db seed
pnpm --filter @onezone/server exec prisma studio
```

Use `migrate deploy` for production and CI. Use `migrate dev --name <name>` only when creating a new local migration.

Key persisted resources include users, refresh tokens, device codes, agents, per-user agent settings, projects, project skills, kanban columns, tasks, task-terminal assignments, messages, terminals, notifications, and task schedules.

## Monorepo Commands

Run these from the repository root.

| Command | Description |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Start all apps in watch mode through Turborepo |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all packages that define a lint script |
| `pnpm typecheck` | Type-check all packages |
| `pnpm clean` | Remove generated build artifacts |
| `pnpm --filter @onezone/server dev` | Run only the NestJS server in watch mode |
| `pnpm --filter web dev` | Run only the Next.js app on port `5025` |
| `pnpm --filter @onezone/terminal dev listen` | Run the terminal CLI from TypeScript |
| `pnpm --filter @onezone/shared build` | Build shared ESM and CommonJS outputs |

## Production Checklist

- Set a strong `JWT_SECRET`; never rely on unset or development-only secrets.
- Set `WEB_ORIGINS` to the exact HTTPS origin(s) of the deployed web app so CORS, secure cookies, and device activation links work correctly.
- Set `NEXT_PUBLIC_API_URL` to the public HTTPS URL of the API reachable by browsers.
- Use managed PostgreSQL and Redis or persistent volumes with backups.
- Run `pnpm --filter @onezone/server exec prisma migrate deploy` during release before starting the server.
- Keep Redis private to the application network and use provider-level authentication/TLS when available.
- Run the server behind HTTPS, or behind a trusted reverse proxy that terminates TLS.
- Use separate terminal workers for untrusted or high-risk automation, and isolate their filesystem, SSH keys, and cloud credentials.
- Restrict Docker terminal volumes to the data you intentionally want persisted: `.ssh`, `.onezone`, `.local`, `.claude`, and `.copilot` are persisted by the provided Compose file.
- Monitor `/health`, container restarts, database connections, Redis availability, schedule execution, terminal heartbeats, and command failure notifications.
- Keep agent provider tokens out of source control and inject them through your deployment secret manager.

## Deployment Notes

- The server exposes REST and Socket.io on the same port. Your reverse proxy must support WebSocket upgrades.
- The web app is built with Next.js and expects `NEXT_PUBLIC_API_URL` at build time when using the Docker image build argument.
- The terminal worker can run inside Docker Compose or on any host with Node.js.
- Cookie security is derived from `WEB_ORIGIN`: HTTPS origins set secure cookies.
- Horizontal server scaling requires all server instances to share the same PostgreSQL database, Redis instance, and JWT configuration.

## Packages

| Package | Description |
|---|---|
| [apps/server](apps/server/README.md) | NestJS backend with REST API, auth, Prisma, schedules, notifications, and Socket.io gateway |
| [apps/web](apps/web/README.md) | Next.js frontend for projects, kanban, task chat, terminals, agents, skills, schedules, notifications, and statistics |
| [apps/terminal](apps/terminal/README.md) | oclif CLI that authenticates, registers terminals, and dispatches assigned agent tasks |
| [packages/shared](packages/shared/README.md) | Shared types, schemas, constants, room helpers, and Socket.io event contracts |

## Troubleshooting

| Symptom | Check |
|---|---|
| Web cannot log in or refresh sessions | Confirm `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`, HTTPS/proxy settings, and cookies are aligned. |
| Terminal says it is not authenticated | Run `onezone-terminal login --server <api-url>` again and complete the activation page. |
| Terminal does not appear connected | Check the server URL, JWT refresh flow, WebSocket upgrades, and terminal heartbeat logs. |
| Tasks do not stream output | Verify the assigned terminal is connected, the task has an agent/model, and the agent credentials are configured. |
| WebSocket events do not fan out in production | Confirm every server instance points at the same reachable Redis instance. |
| Docker terminal repeatedly asks for login | Ensure the `terminal_workdir` volume is writable and persisted, and that `WEB_ORIGIN` points at a reachable activation page. |

## License

This repository is currently private and does not declare an open-source license.