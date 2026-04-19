# OneZone Agent Runner

**Branch:** `feat/onezone-agent-runner`
**Description:** Build a platform where users create projects with tasks, each task has a flat chat room where users can type messages and CLI agents stream process output (ffmpeg, ffprobe, etc.) in real time. PostgreSQL stores data; Redis backs the socket.io pub/sub layer.

## Goal

Users create Projects and within each project create Tasks. Each task has a dedicated flat chat room. CLI agents connect to a specific task room, run arbitrary processes, and stream every line of stdout/stderr to that room in real time. Users can also type messages into the task room from the frontend.

## Core Mental Model

```
User → creates a Project
             │
             ├── Task A  →  Chat Room (task:{taskId})
             │                   │
             │        ┌──────────┴──────────┐
             │        │  user messages      │  ← user types here
             │        │  agent output lines │  ← agent streams here
             │        └──────────┬──────────┘
             │                   │ (WebSocket)
             │        ┌──────────┴──────────┐
             │        │  Agent CLI          │
             │        │  runs ffmpeg, etc.  │
             │        └─────────────────────┘
             │
             └── Task B  →  Chat Room (task:{taskId})
                                 │
                              ...
```

All messages (user + agent output) flow to the same flat task room. Multiple agents can be active in the same task room simultaneously.

## Implementation Steps

---

### Step 1: Monorepo Scaffold + Infrastructure

**Files:**
- `package.json` (root, private, pnpm workspaces)
- `pnpm-workspace.yaml`
- `turbo.json`
- `.gitignore`
- `.nvmrc` (Node 22)
- `docker-compose.yml` — PostgreSQL + Redis services
- `.env.example` — `DATABASE_URL`, `REDIS_URL`

**What:** Initialize the Turborepo + pnpm monorepo root with workspace configuration and shared scripts (`dev`, `build`, `lint`). Also define the Docker Compose stack that all local development depends on.

`docker-compose.yml` services:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: onezone
      POSTGRES_USER: onezone
      POSTGRES_PASSWORD: onezone
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

volumes:
  postgres_data:
```

**Testing:** `pnpm install` succeeds; `docker compose up -d` starts both services healthy; `docker compose ps` shows both running.

---

### Step 2: Shared Package (`packages/shared`)

**Files:**
- `packages/tsconfig/tsconfig.base.json`
- `packages/tsconfig/package.json`
- `packages/shared/src/types.ts` — Project, Task, Message types
- `packages/shared/src/events.ts` — WebSocket event contracts
- `packages/shared/src/schemas.ts` — Zod schemas for validation
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`

**What:** Define all shared TypeScript types and Zod schemas used across server, web, and agent packages.

Core types:

```ts
type Message = {
  id: string;
  roomId: string;          // "task:{taskId}"
  role: 'user' | 'agent' | 'system';
  agentId?: string;
  agentName?: string;
  command?: string;
  stream?: 'stdout' | 'stderr';
  content: string;
  ts: number;
};
```

Socket events:
- `chat:message` — user → server → room (user typed a message)
- `output:line` — agent → server → room (one line of process output)
- `agent:connected` — agent → server → room (agent announces itself)
- `agent:disconnected` — server → room (agent disconnected)
- `agent:command:start` — agent → server → room (about to run a command)
- `agent:command:exit` — agent → server → room (command finished with exit code)

**Testing:** `pnpm --filter @onezone/shared build` compiles without errors.

---

### Step 3: NestJS Server — REST API + Database

**Files:**
- `apps/server/` (NestJS scaffold)
- `apps/server/src/projects/projects.module.ts`
- `apps/server/src/projects/projects.controller.ts` — Projects CRUD
- `apps/server/src/projects/projects.service.ts`
- `apps/server/src/tasks/tasks.module.ts`
- `apps/server/src/tasks/tasks.controller.ts` — Tasks CRUD per project
- `apps/server/src/tasks/tasks.service.ts`
- `apps/server/src/messages/messages.module.ts`
- `apps/server/src/messages/messages.controller.ts` — history endpoint
- `apps/server/src/messages/messages.service.ts`
- `apps/server/prisma/schema.prisma` — Prisma schema
- `apps/server/src/prisma/prisma.service.ts` — `PrismaClient` wrapper
- `apps/server/src/prisma/prisma.module.ts` — global module
- `apps/server/src/app.module.ts`
- `apps/server/package.json`

**What:** Scaffold the NestJS server with REST endpoints for projects, tasks, and message history. Uses Prisma ORM with PostgreSQL. `DATABASE_URL` is read from env. Migrations managed via `prisma migrate dev`.

Prisma schema (`schema.prisma`):

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Project {
  id          String   @id @default(uuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  tasks       Task[]
}

model Task {
  id          String    @id @default(uuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  description String?
  createdAt   DateTime  @default(now())
  messages    Message[]
}

model Message {
  id        String   @id @default(uuid())
  roomId    String   // "task:{taskId}"
  role      String   // 'user' | 'agent' | 'system'
  agentId   String?
  agentName String?
  command   String?
  stream    String?  // 'stdout' | 'stderr'
  content   String
  ts        BigInt
  task      Task     @relation(fields: [roomId], references: [id])
}
```

REST endpoints:

```
POST   /projects                        { name, description } → 201 Project
GET    /projects                        → 200 Project[]
GET    /projects/:id                    → 200 Project
DELETE /projects/:id                    → 204

POST   /projects/:id/tasks              { name, description } → 201 Task
GET    /projects/:id/tasks              → 200 Task[]
GET    /tasks/:taskId                   → 200 Task
DELETE /tasks/:taskId                   → 204

GET    /tasks/:taskId/messages          → 200 Message[]  (ordered by ts)
```

**Testing:**
```bash
# Start infra first
docker compose up -d
pnpm --filter @onezone/server exec prisma migrate dev --name init

curl -X POST http://localhost:3001/projects -d '{"name":"MyProject","description":"..."}'
curl -X POST http://localhost:3001/projects/:id/tasks -d '{"name":"Encode video"}'
curl http://localhost:3001/tasks/:taskId/messages
```

---

### Step 4: NestJS Server — WebSocket Hub (Redis adapter)

**Files:**
- `apps/server/src/gateways/chat.gateway.ts`
- `apps/server/src/gateways/gateways.module.ts`
- `apps/server/src/app.module.ts` — configure `@socket.io/redis-adapter`

**What:** Add a socket.io gateway on the `/chat` namespace backed by the Redis pub/sub adapter. This allows multiple server instances to fan out messages correctly, and keeps socket.io room state in Redis. `REDIS_URL` is read from env.

Setup in `main.ts` / `app.module.ts`:
```ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

Gateway behaviour (connecting clients send `taskId`, optionally `agentId`, `agentName`, `role` via socket `auth`):

1. On `connect` → validates `taskId` exists in DB → joins client to room `task:{taskId}` → broadcasts `agent:connected` if role is `agent`
2. On `chat:message` (from user) → persists with `role:'user'` → broadcasts to room
3. On `output:line` (from agent) → persists with `role:'agent'` → broadcasts to room
4. On `agent:command:start` → persists system message → broadcasts to room
5. On `agent:command:exit` → persists system message → broadcasts to room
6. On `disconnect` → broadcasts `agent:disconnected` if it was an agent

Room naming: `task:{taskId}` — flat, all participants (user + agents) share the same room.

**Testing:** `docker compose up -d` running. Two socket.io-client scripts join the same task room; one emits `chat:message`, the other receives it. Agent emits `output:line`, user observer receives it. Message appears in `GET /tasks/:taskId/messages`.

---

### Step 5: Agent CLI (`apps/agent`)

**Files:**
- `apps/agent/` (oclif scaffold)
- `apps/agent/src/commands/run.ts` — main command: `onezone-agent run [cmd] [args...]`
- `apps/agent/src/lib/socket-client.ts` — socket.io-client wrapper
- `apps/agent/src/lib/process-runner.ts` — spawns process, streams output
- `apps/agent/package.json`
- `apps/agent/tsconfig.json`

**What:** Build the `onezone-agent` oclif CLI. The `run` command:

1. Connects to the server's `/chat` namespace with `auth: { taskId, agentId, agentName, role: 'agent' }`
2. Emits `agent:command:start` with the command string
3. Spawns the given command as a subprocess via `child_process.spawn`
4. For each line on stdout/stderr, emits `output:line` to the server
5. On process exit, emits `agent:command:exit` with the exit code, then disconnects

```ts
// process-runner.ts
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

function runProcess(cmd: string, args: string[], onLine: (stream, line) => void, onExit: (code) => void) {
  const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  
  createInterface({ input: proc.stdout }).on('line', line => onLine('stdout', line));
  createInterface({ input: proc.stderr }).on('line', line => onLine('stderr', line));
  proc.on('close', code => onExit(code ?? -1));
}
```

CLI flags: `--task <taskId>`, `--server <url>` (default: `http://localhost:3001`), `--name <agent-name>` (default: hostname)

Example usage:
```bash
onezone-agent run --task task123 ffmpeg -i input.mp4 -c:v libx264 output.mp4
onezone-agent run --task task123 --name prober ffprobe input.mp4
```

**Testing:**
```bash
# Terminal 1: Start server
pnpm --filter @onezone/server dev

# Terminal 2: Observe room via wscat
wscat -c "ws://localhost:3001/chat" -x '{"auth":{"taskId":"task123","role":"user"}}'

# Terminal 3: Run agent
onezone-agent run --task task123 ffprobe -v quiet -print_format json -show_format input.mp4
# → Lines appear in Terminal 2 in real time
```

---

### Step 6: Next.js Frontend (`apps/web`)

**Files:**
- `apps/web/` (Next.js 15 App Router scaffold)
- `apps/web/src/app/page.tsx` — projects list with "New Project" button
- `apps/web/src/app/projects/new/page.tsx` — create project form
- `apps/web/src/app/projects/[id]/page.tsx` — project detail: tasks list + "New Task" button
- `apps/web/src/app/projects/[id]/tasks/new/page.tsx` — create task form
- `apps/web/src/app/projects/[id]/tasks/[taskId]/page.tsx` — task chat room
- `apps/web/src/hooks/useTaskRoom.ts` — socket.io-client hook for a task room
- `apps/web/src/lib/api.ts` — REST API client (TanStack Query)
- `apps/web/src/components/MessageLine.tsx` — renders a single message or output line
- `apps/web/src/components/AgentStatusBar.tsx` — shows currently connected agents
- `apps/web/src/components/MessageInput.tsx` — text input for user to type messages
- `apps/web/package.json`

**What:** Three-level navigation: projects list → project (tasks list) → task (chat room).

The task chat room page is the core UI:
- **Header:** task name + project name + list of currently connected agents (updated via `agent:connected` / `agent:disconnected`)
- **Message area:** scrolling log of all messages (user + agent output), color-coded by role and stream (stderr = red/muted). Auto-scrolls to bottom.
- **Message format:** user messages show plainly; agent output lines show `[agent-name] [stdout/stderr] content`
- **Input bar:** text field + send button; on submit emits `chat:message` to the task room

History loaded via `GET /tasks/:taskId/messages` (TanStack Query) on mount, live-updated via socket events.

**Testing:**
- Create a project → appears on project list
- Create a task → appears on project detail page
- Open task → empty chat room with input bar
- Type a message → appears in the room immediately
- Run `onezone-agent run --task <taskId> ffprobe ...` → output lines appear in real time
- Reload page → history loads correctly from REST
