# web

The Onezone web app is a Next.js dashboard for managing projects, kanban task flow, task chat, terminals, agents, schedules, notifications, skills, and usage statistics. It communicates with the server through REST and Socket.io.

## Stack

- Next.js 16 App Router with React 19.
- TanStack Query 5 for server state and cache invalidation.
- Socket.io client for live task, terminal, notification, and cost updates.
- Tailwind CSS 4 with shadcn/Radix-style UI primitives.
- Lexical for rich task descriptions.
- `@dnd-kit` for kanban drag-and-drop.
- React Hook Form for form state.
- Lucide React icons.

## Features

- Register, log in, refresh sessions, log out, and activate CLI device-code logins.
- Create projects with default agent/model settings and optional repository metadata.
- Import and export projects.
- Manage global and project-scoped skills.
- Configure agents and user-specific model overrides.
- Create, edit, assign, reorder, complete, and delete tasks.
- Move tasks through backlog, custom kanban columns, and completed state.
- Assign terminals to tasks and monitor connection state.
- Chat inside tasks while streaming terminal command output in real time.
- Create and run recurring schedules for automated task creation/execution.
- View notifications and unread counts for command and task events.
- Review project and global statistics including command success/failure, tokens, and cost.

## Routes

| Route | Description |
|---|---|
| `/auth/register` | Create an account |
| `/auth/login` | Log in to the web app |
| `/auth/activate` | Approve CLI device-code login |
| `/onboarding` | Initial user/project setup flow |
| `/` | Project list |
| `/projects/[id]` | Project kanban board, project actions, schedules, and cost summary |
| `/projects/[id]/tasks/[taskId]` | Task chat, terminal output, task metadata, and controls |
| `/agents` | Agent and model configuration |
| `/terminals` | Connected and registered terminal workers |
| `/skills` | Global skills management |
| `/notifications` | Notification inbox |
| `/statistics` | Usage and cost statistics |

## Development

From the repository root:

```bash
docker compose up postgres redis -d
pnpm install
pnpm --filter @onezone/server exec prisma migrate deploy
pnpm --filter @onezone/server exec prisma db seed
pnpm --filter web dev
```

The app runs on [http://localhost:5025](http://localhost:5025).

## Scripts

| Command | Description |
|---|---|
| `pnpm --filter web dev` | Start Next.js on port `5025` |
| `pnpm --filter web build` | Create a production build |
| `pnpm --filter web start` | Start the production Next.js server |
| `pnpm --filter web lint` | Run ESLint |
| `pnpm --filter web typecheck` | Type-check without emitting |

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5026` | Yes | Browser-visible Onezone server URL for REST and Socket.io |

When using the Docker image, `NEXT_PUBLIC_API_URL` is passed as a build argument, so set it before building the image for each deployment environment.

## Production Notes

- Deploy the web app behind HTTPS.
- Set `NEXT_PUBLIC_API_URL` to the public HTTPS API URL reachable from users' browsers.
- Make sure the server `WEB_ORIGIN` exactly matches the deployed web origin.
- Ensure the API reverse proxy supports WebSocket upgrades for Socket.io.
- Build after environment variables are set because public Next.js variables are embedded in the client bundle.
- Do not expose server-only secrets through `NEXT_PUBLIC_*` variables.

## UI Conventions

- Shared UI components live under `src/components/ui`.
- App routes live under `src/app` and use the App Router.
- API helpers and auth/socket utilities live under `src/lib`.
- Real-time task and project hooks live under `src/hooks`.
- Keep server state in TanStack Query and use Socket.io events to update or invalidate affected queries.
