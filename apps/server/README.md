# @onezone/server

The Onezone backend is a NestJS service that owns authentication, REST resources, Prisma persistence, scheduled task execution, notifications, and the Socket.io gateway used by the web app and terminal workers.

## Stack

- NestJS 10 with global validation pipes and a global JWT guard.
- Prisma 5 with PostgreSQL.
- Socket.io 4 with a Redis adapter for multi-instance real-time delivery.
- Nest Schedule and `cron` for recurring task schedules.
- HTTP-only auth cookies, bearer-token CLI auth, refresh tokens, and device-code login.
- `class-validator`, `class-transformer`, and shared Zod contracts for payload validation.
- S3-compatible storage for project-level memory reads and writes.

## Runtime Responsibilities

| Area | What it does |
|---|---|
| Auth | Signup, login, refresh, logout, current user, CLI device-code activation, admin email lookup |
| Projects | Project CRUD, import/export, skills, kanban columns, project statistics, project cost stats |
| Tasks | Task CRUD, reorder, complete, move between columns, assign terminal, task details |
| Messages | Chat history, command start/exit records, streamed terminal output |
| Terminals | Register workers, track connection status, assign tasks, disconnect/delete terminals |
| Agents | Agent registry and per-user/global model settings |
| Schedules | Create, update, enable, run, and delete cron-based task schedules |
| Notifications | List, count, mark read, and create task/command notifications |
| Memory | List, read, write, and delete project-scoped key-value entries backed by S3 |
| S3 | Internal S3-compatible storage service for project memory |

## Development

From the repository root:

```bash
docker compose up postgres redis -d
pnpm install
pnpm --filter @onezone/server exec prisma migrate deploy
pnpm --filter @onezone/server exec prisma db seed
pnpm --filter @onezone/server dev
```

The server listens on port `5026` by default. The health endpoint is `GET /health`.

## Scripts

| Command | Description |
|---|---|
| `pnpm --filter @onezone/server dev` | Start Nest in watch mode |
| `pnpm --filter @onezone/server build` | Compile to `dist` |
| `pnpm --filter @onezone/server start` | Run `dist/main.js` |
| `pnpm --filter @onezone/server lint` | Lint server source |
| `pnpm --filter @onezone/server typecheck` | Type-check without emitting |
| `pnpm --filter @onezone/server clean` | Remove `dist` |

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | none | Yes | PostgreSQL connection string used by Prisma |
| `REDIS_URL` | `redis://localhost:6379` | Yes | Redis URL used by the Socket.io adapter |
| `WEB_ORIGINS` | `http://localhost:5025` | Yes | Comma-separated allowed origins for CORS, cookies, and CLI device activation URLs |
| `PORT` | `5026` | No | HTTP and WebSocket port |
| `JWT_SECRET` | none | Yes | Access-token signing secret |
| `JWT_EXPIRES_IN` | `15m` in Compose | Yes | Access-token cookie lifetime, for example `15m` or `1h` |
| `REFRESH_TOKEN_EXPIRES_IN` | `30d` in Compose | Yes | Refresh-token lifetime in days, for example `30d` |
| `ADMIN_EMAILS` | empty | No | Comma-separated list of emails treated as admins |
| `S3_ENDPOINT` | none | Yes | S3-compatible endpoint for project memory storage |
| `S3_ACCESS_KEY_ID` | none | Yes | S3 access key for project memory storage |
| `S3_SECRET_ACCESS_KEY` | none | Yes | S3 secret key for project memory storage |

## API Surface

All routes except explicitly public auth routes are protected by the global JWT guard.

| Resource | Routes |
|---|---|
| Auth | `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/device`, `POST /auth/token`, `POST /auth/activate` |
| Projects | `GET /projects`, `POST /projects`, `GET /projects/statistics`, `GET /projects/:id`, `PATCH /projects/:id`, `DELETE /projects/:id`, `GET /projects/:id/export`, `POST /projects/import`, `GET /projects/:id/cost-stats` |
| Project skills | `GET /skills`, `POST /skills`, `DELETE /skills/:skillId`, plus project-scoped skill routes under `/projects/:id/skills` |
| Kanban columns | `GET/POST /projects/:projectId/kanban-columns`, `GET/PATCH/DELETE /projects/:projectId/kanban-columns/:columnId`, `PUT /projects/:projectId/kanban-columns/reorder` |
| Tasks | `GET /tasks/:taskId`, `PATCH /tasks/:taskId`, `PATCH /tasks/:taskId/column`, `PATCH /tasks/:taskId/complete`, `PATCH /tasks/:taskId/terminal`, `DELETE /tasks/:taskId` |
| Project tasks | `GET/POST /projects/:projectId/tasks`, `GET /projects/:projectId/tasks/:taskId`, `PUT /projects/:projectId/tasks/reorder` |
| Messages | `GET /tasks/:taskId/messages` |
| Terminals | `GET /terminals`, `POST /terminals/register`, `POST /terminals/:terminalId/disconnect`, `POST /terminals/:terminalId/assign-task`, `DELETE /terminals/:terminalId` |
| Agents | `GET /agents`, `GET /agents/:id`, `PATCH /agents/:id`, `PATCH /agents/:id/global` |
| Schedules | `GET/POST /projects/:projectId/schedules`, `GET/PATCH/DELETE /schedules/:id`, `POST /schedules/:id/run` |
| Memory | `GET /projects/:projectId/memory`, `GET /projects/:projectId/memory/:key`, `POST /projects/:projectId/memory/:key`, `DELETE /projects/:projectId/memory/:key` |
| Health | `GET /health`, `GET /health/live`, `GET /health/ready` |

## WebSocket Events

Socket contracts are defined in `@onezone/shared`. Important events include:

- `chat:message` for task chat messages.
- `output:line` for terminal stdout/stderr streaming.
- `terminal:connected` and `terminal:disconnected` for terminal presence.
- `terminal:command:start`, `terminal:command:exit`, `terminal:command:run`, and `terminal:command:stop` for command lifecycle.
- `terminal:heartbeat` for worker liveness.
- `terminal:assign-task` for dispatching work to a connected worker.
- `task:deleted`, `task:column-updated`, `notification:created`, and `project:cost-updated` for live UI updates.

## Database

The Prisma schema is in `prisma/schema.prisma`, and migrations are in `prisma/migrations`.

```bash
pnpm --filter @onezone/server exec prisma migrate dev --name <migration-name>
pnpm --filter @onezone/server exec prisma migrate deploy
pnpm --filter @onezone/server exec prisma db seed
pnpm --filter @onezone/server exec prisma studio
```

Use `migrate deploy` outside local migration authoring. The seed script registers the default agents and any baseline data required by the app.

## Production Notes

- Set `WEB_ORIGINS`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and `REFRESH_TOKEN_EXPIRES_IN` explicitly.
- Put the server behind HTTPS and a reverse proxy that supports WebSocket upgrades.
- Run all server instances against the same PostgreSQL database, Redis instance, and JWT settings.
- Keep Redis private to the application network and enable provider authentication/TLS where available.
- Run Prisma migrations before deploying new server code.
- Monitor `/health`, database connectivity, Redis connectivity, terminal heartbeats, schedule execution, and command failure notifications.
