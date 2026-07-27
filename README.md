# Onezone

**Stop babysitting one terminal at a time. Onezone turns Claude Code, GitHub Copilot CLI, and Opencode into a fleet of coding agents you run, watch, and automate from a single web workspace.**

Describe what you want built, and a connected agent turns it into a full kanban board of tasks — complete with the skills it needs to do the job. From there, spin up as many terminals as you want, running in Docker for a clean sandbox, and let them work your backlog in parallel while you watch every command stream live. Every project keeps a living memory wiki so agents get smarter about *your* codebase instead of starting from zero on every run, and skills you install once are shared across every terminal that picks up the work. Need something to happen automatically? Schedule it. Need it to happen right now, without following the board? Bypass it.

## Why Onezone

- 🧠 **Generate a project board from a description.** Tell a connected agent what you're building, and it plans the columns, tasks, and skills for you through the `onezone-project-builder` skill — the project sits in `pending` until the board is ready to work.
- 📦 **Terminals run sandboxed, in Docker.** Point agents at real work without pointing them at your host machine. The bundled Docker terminal isolates the filesystem, credentials, and SSH keys per worker.
- ⚡ **Parallel by design.** Connect one terminal or twenty. Every terminal pulls from the same board, streams output over Socket.io, and works its own task without stepping on the others.
- 🗂️ **Project memory that compounds.** A Karpathy-style wiki (raw facts → compiled topic articles → a navigable index) is stored remotely via Garage/S3 and read at the start of every task, so lessons learned on Monday still apply on Friday.
- 🔁 **Skills and memory are shared, not siloed.** Any terminal working a project sees the same skills and the same memory wiki — install a skill once, every worker benefits.
- 🌐 **Global skills for every project, plus per-project skills.** Install a skill at the account level and it's automatically available across all of your projects, no per-project setup required — or install a skill on just one project when it's only relevant there.
- 🤖 **Pick your agent, per task.** Claude Code, GitHub Copilot CLI, and Opencode are all first-class. Choose a default globally, then override the agent and model per user, per task, per kanban column, or per schedule.
- ⏰ **Scheduled tasks, cron or one-shot.** Recurring workflows run on cron expressions with time zone support; ad-hoc automation runs once and stops.
- 🚦 **Bypass mode for one-off runs.** Skip the kanban board entirely and run a task's own name/description in isolation when you just need a quick, self-contained job done.
- 🚀 **RTK installed automatically.** The Docker terminal image ships with [RTK](https://github.com/rtk-ai/rtk) preinstalled and wired into agent hooks, cutting token usage on every command without any manual setup.
- 📤 **Export a project, import it anywhere.** A project's board, columns, default agent/model, and skills export as a single portable config — clone a proven workflow into a new project or a new environment in one import.
- 🔒 **Your projects, your data.** Every project, task, terminal, skill, schedule, and notification is scoped to your account.

## What You Get

- Project workspaces with kanban columns, backlog, completion state, project import/export, and project-level skills.
- Portable project configs: export a project's columns, default agent/model, and skills as a single JSON blueprint, then import it to spin up a new project with the same setup.
- AI-assisted project generation: describe a workflow and a connected terminal generates the project's kanban board (and optional skills) through the `onezone-project-builder` skill while the project sits in a `pending` status until the board is ready.
- Task assignment to connected terminals with real-time chat, stdout/stderr streaming, command lifecycle events, and stop signals.
- Bypass mode for tasks and schedules that runs a task's own name/description in isolation, ignoring kanban column instructions and completing immediately when the run finishes.
- Agent registry for Claude Code, GitHub Copilot CLI, and Opencode style runners, with global defaults and per-user model overrides.
- Project memory backed by self-hosted Garage (S3-compatible) storage for key-value reads and writes scoped to each project, shared by every terminal that works on it.
- Global skills that apply across all of a user's projects, alongside project-level skills shared by every terminal assigned to that project.
- Scheduled tasks powered by cron expressions, time zones, optional one-shot runs, bypass mode, and terminal/agent/model selection.
- Authentication with email/password, HTTP-only cookies, JWT access tokens, refresh tokens, and CLI device-code login.
- Notifications for command starts, command exits, failures, and completed tasks, mirrored as OS-level system notifications through the web app's service worker.
- Usage statistics for tasks, command outcomes, token counts, and estimated project costs.
- Shared TypeScript contracts and Zod schemas used across the server, web app, and terminal CLI.

## Pros

- **Bring your own terminals**: run agents on your laptop, a workstation, a Docker worker, or a remote runner while managing them from one UI.
- **Sandboxed by default**: the bundled Docker terminal image runs agents in an isolated container, with RTK preinstalled and configured out of the box.
- **Parallel-first**: connect as many terminals as you need and let them pick up tasks from the same board simultaneously.
- **Real-time by default**: Socket.io events keep the board, task chat, terminal state, notifications, and command output live.
- **Multi-user ready**: projects, tasks, terminals, messages, notifications, skills, schedules, and agent settings are scoped by user, so each teammate works their own isolated set of projects on a shared deployment.
- **Portable project setups**: export a project's board, agent/model defaults, and skills to JSON and import it into a new project to reuse a proven workflow instantly.
- **Production-shaped stack**: PostgreSQL persistence, Redis-backed WebSockets, Prisma migrations, Docker images, health checks, and explicit environment configuration.
- **Agent flexible**: Claude Code, GitHub Copilot CLI, and Opencode are first-class, and model values are configurable globally, per user, per task, per column, and per schedule where supported.
- **Automation friendly**: recurring schedules, one-time scheduled runs, and kanban column instructions let users turn repeated development workflows into repeatable agent runs — or bypass the board for a quick one-off task.
- **Memory that travels with the project**: a shared, remotely-stored wiki keeps every terminal working from the same up-to-date knowledge of the codebase.
- **Type-safe contracts**: shared enums, payload types, room helpers, constants, and validation schemas reduce drift between packages.

## Architecture

This repository is a pnpm and Turborepo monorepo.

```text
onezone/
|-- apps/
|   |-- server/     # NestJS REST API, auth, Prisma, schedules, Socket.io gateway on port 5026
|   |-- web/        # Next.js dashboard UI on port 5025
|   `-- terminal/   # oclif CLI that registers terminals and executes assigned agent tasks
|-- packages/
|   |-- shared/     # Shared TypeScript types, Zod schemas, constants, and Socket.io event contracts
|   `-- tsconfig/   # Shared TypeScript configuration
`-- docker/         # Self-hosted Garage (S3-compatible) storage image and config
```

Runtime services:

| Service | Default port | Purpose |
|---|---:|---|
| Web | `5025` | Browser UI for projects, tasks, terminals, agents, schedules, notifications, and statistics |
| Server | `5026` | REST API, auth, WebSocket gateway, schedule runner, and health endpoint |
| PostgreSQL | `5432` | Persistent application data through Prisma |
| Redis | `6379` | Socket.io Redis adapter for real-time fan-out and horizontal scaling |
| Garage | `3900-3903` | Self-hosted S3-compatible object storage for project memory (built from `docker/garage.Dockerfile`) |
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
docker compose up postgres redis garage -d
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
| `OPENCODE_PROVIDER_ID` | Terminal agent runtime | `default` | No | Optional model provider ID for Opencode. |
| `OPENCODE_PROVIDER_BASE_URL` | Terminal agent runtime | none | No | Optional custom model provider base URL for Opencode. |
| `OPENCODE_PROVIDER_API_KEY` | Terminal agent runtime | none | No | Optional custom model provider API key for Opencode. |
| `S3_ENDPOINT` | Server | `http://garage:3900` in Compose | Yes | S3-compatible endpoint for project memory storage (the bundled Garage service by default) |
| `S3_REGION` | Server | `garage` | No | S3-compatible region name, required by some S3 clients even for single-region setups |
| `S3_ACCESS_KEY_ID` | Server | `GKonezone` in Compose | Yes | S3 access key for project memory storage |
| `S3_SECRET_ACCESS_KEY` | Server | generated value in Compose | Yes | S3 secret key for project memory storage |
| `S3_BUCKET_NAME` | Server | `onezone` | No | S3 bucket name for project memory storage |

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
S3_ENDPOINT=http://garage:3900
S3_REGION=garage
S3_ACCESS_KEY_ID=GKonezone
S3_SECRET_ACCESS_KEY=3a2a8c6903c5e28fe7468494c5d73d64dfd88581e166cb25cce043ff8eb11410
S3_BUCKET_NAME=onezone
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

Key persisted resources include users, refresh tokens, device codes, agents, per-user agent settings, projects (with a `pending`/`ready`/`failed` status used by AI-assisted project generation), project skills, kanban columns, tasks and task schedules (both with a `bypass` flag), task-terminal assignments, messages, terminals, and notifications.

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