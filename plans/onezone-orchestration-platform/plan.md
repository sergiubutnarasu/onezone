# OneZone Orchestration Platform

**Branch:** `feat/onezone-orchestration-platform`
**Description:** Build a multi-agent orchestration platform modeled as a chat system: users chat with an orchestrator, and the orchestrator opens separate chat channels with each agent it spawns. All AI work is done by spawning `claude` (Claude Code CLI) as a subprocess.

## Goal

Build a platform where the user opens a "chat" with an orchestrator (per project). The orchestrator decomposes work and spawns agents — each agent gets its own dedicated chat channel with the orchestrator. All communication is over WebSocket via the NestJS server acting as a message hub. The Next.js frontend lets users create projects, send messages to the orchestrator, and observe all chat threads (user↔orchestrator and orchestrator↔agents) in real time.

## Core Mental Model: Chat Rooms

```
User → creates a Project → server spawns Orchestrator
                                │
              ┌─────────────────┴──────────────────────┐
              │  Chat room: user ↔ orchestrator         │  ← user sees this
              │  (projectId)                            │
              └─────────────────┬──────────────────────┘
                    Orchestrator spawns Agents
                    │                        │
        ┌───────────▼──────────┐  ┌──────────▼───────────┐
        │ Chat: orch ↔ agent-1 │  │ Chat: orch ↔ agent-2  │  ← user can observe
        │ (projectId:agent-1)  │  │ (projectId:agent-2)   │
        └──────────────────────┘  └───────────────────────┘
```

Each "chat" is a socket.io room. Messages have a `role` (`user`, `orchestrator`, `agent`) and a `content` string.

## Implementation Steps

### Step 1: Monorepo Scaffold
**Files:**
- `package.json` (root, private, pnpm workspaces)
- `pnpm-workspace.yaml`
- `turbo.json`
- `.gitignore`
- `.nvmrc` (Node 22)

**What:** Initialize the Turborepo + pnpm monorepo root with workspace configuration and shared scripts (`dev`, `build`, `lint`). No app code yet — just the skeleton every other step builds on.

**Testing:** `pnpm install` succeeds; `turbo run build` exits cleanly with no packages to build.

---

### Step 2: Shared Packages (`packages/tsconfig` + `packages/shared`)
**Files:**
- `packages/tsconfig/tsconfig.base.json`
- `packages/tsconfig/package.json`
- `packages/shared/src/events.ts` — WebSocket event contracts
- `packages/shared/src/schemas.ts` — Project, ChatRoom, Message, ClaudeStreamEvent Zod schemas
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`

**What:** Define all shared TypeScript types. The central type is `ChatMessage`:

```ts
type ChatMessage = {
  roomId: string;         // "proj:{id}" or "proj:{id}:agent:{agentId}"
  role: 'user' | 'orchestrator' | 'agent';
  content: string;
  ts: number;
};
```

Socket events:
- `chat:message` — send/receive a message in a room
- `agent:spawned` — orchestrator notifies server it spawned an agent (creates new room)
- `agent:done` — agent signals task complete to orchestrator

Claude Code CLI stream event shape (parsed from `--output-format stream-json`):
```ts
type ClaudeStreamEvent = 
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'result'; subtype: 'success' | 'error'; result: string };
```

**Testing:** `pnpm --filter @onezone/shared build` compiles without errors.

---

### Step 3: NestJS Server — REST API + Database
**Files:**
- `apps/server/` (full NestJS scaffold)
- `apps/server/src/projects/` — Projects module: CRUD (create / list / get / delete)
- `apps/server/src/messages/` — Messages module: persist all chat messages per room
- `apps/server/src/database/` — SQLite via Drizzle ORM

**What:** Scaffold the NestJS server with a REST API for managing projects and retrieving message history.

Tables:
- `projects` — id, name, description, status
- `chat_rooms` — id, projectId, type (`user-orchestrator` | `orchestrator-agent`), agentId?
- `messages` — id, roomId, role, content, ts

**Testing:**
```
POST /projects { name, description } → 201
GET  /projects → 200 []
GET  /projects/:id/rooms → 200 (all chat rooms for this project)
GET  /rooms/:roomId/messages → 200 (message history)
```

---

### Step 4: NestJS Server — WebSocket Chat Hub
**Files:**
- `apps/server/src/gateways/chat.gateway.ts`
- `apps/server/src/gateways/room-registry.service.ts` — manages socket.io rooms, tracks participants

**What:** Add a socket.io gateway (`/chat` namespace). Every connected client joins a room on connect via `auth.roomId`. The gateway:

1. Receives `chat:message` → persists to DB → broadcasts to all room members
2. Receives `agent:spawned` (from orchestrator) → creates new `orchestrator-agent` chat room in DB → confirms room created
3. Receives `agent:done` (from agent) → notifies orchestrator room

Room naming convention:
- User ↔ Orchestrator: `proj:{projectId}`
- Orchestrator ↔ Agent: `proj:{projectId}:agent:{agentId}`

**Testing:** Two socket.io clients join the same room; one sends `chat:message`, the other receives it. `agent:spawned` creates a new room visible via REST.

---

### Step 5: Agent CLI (`apps/agent`)
**Files:**
- `apps/agent/` (oclif scaffold)
- `apps/agent/src/commands/start.ts` — main command
- `apps/agent/src/claude-runner.ts` — spawns and manages the `claude` subprocess

**What:** Build the `onezone-agent` oclif CLI. On start it connects to the server's `/chat` namespace and joins its dedicated room `proj:{projectId}:agent:{agentId}`. It listens for `chat:message` from the orchestrator (the task), then spawns `claude` as a subprocess:

```bash
claude -p "<task>" \
  --output-format stream-json \
  --dangerously-skip-permissions \
  --max-turns 20
```

Each newline-delimited JSON event from stdout is forwarded as a `chat:message` with `role:'agent'` to the server. When the subprocess exits, emits `agent:done`.

Key flags: `--server`, `--project`, `--agent-id`, `--workdir`

**Testing:**
```bash
onezone-agent start --project <id> --agent-id agent-1 --workdir ./workspace
# Send a chat:message to its room from the orchestrator side
# Verify claude subprocess runs and streamed output arrives back in the room
```

---

### Step 6: Orchestrator CLI (`apps/orchestrator`)
**Files:**
- `apps/orchestrator/` (oclif scaffold)
- `apps/orchestrator/src/commands/start.ts`
- `apps/orchestrator/src/claude-runner.ts` — spawns `claude` subprocess for decomposition and synthesis
- `apps/orchestrator/src/agent-manager.ts` — spawns `onezone-agent` subprocesses, assigns agent IDs

**What:** Build the `onezone-orchestrator` oclif CLI. It:

1. Joins room `proj:{projectId}` (the user↔orchestrator chat)
2. Receives a user message (the goal)
3. Spawns `claude` subprocess to decompose the goal into tasks (outputs structured JSON listing tasks + agent count)
4. For each task: emits `agent:spawned` to server (creates the room), spawns an `onezone-agent` subprocess targeting that room
5. Sends each agent its task as a `chat:message`
6. Listens for `agent:done` events; once all agents complete, spawns `claude` again to synthesize results and posts the final reply to the user room

Key flags: `--server`, `--project`

**Testing:**
```bash
onezone-orchestrator start --project <id>
# Send a message to the user-orchestrator room from the frontend/wscat
# Verify orchestrator spawns claude, creates agent rooms, spawns agents
```

---

### Step 7: Next.js Frontend (`apps/web`)
**Files:**
- `apps/web/` (Next.js 15 App Router scaffold)
- `apps/web/src/app/page.tsx` — projects list
- `apps/web/src/app/projects/new/page.tsx` — create project form
- `apps/web/src/app/projects/[id]/page.tsx` — main chat UI
- `apps/web/src/hooks/useChat.ts` — socket.io-client hook for a room
- `apps/web/src/lib/api.ts` — REST API client (TanStack Query)

**What:** The project detail page is the core UI: a two-pane layout.
- **Left pane:** the user↔orchestrator chat (`proj:{id}`) — user types messages, orchestrator replies
- **Right pane:** list of agent rooms (`proj:{id}:agent:*`) — each expandable to show the orchestrator↔agent chat transcript

All chats update in real time via WebSocket. Message history is loaded from REST on mount and live-updated via `chat:message` events.

**Testing:**
- Create a project, open it → left pane shows empty chat
- Type a goal → orchestrator responds; right pane shows agent chats appearing dynamically
- Reload page → history loads from REST correctly

---

## Architecture Diagram

```
                        NestJS Server :3000
                   ┌────────────────────────────┐
                   │ REST: /projects, /rooms     │
                   │ WS:   /chat namespace       │
                   │                             │
                   │  rooms (socket.io):         │
                   │  ┌─────────────────────┐    │
                   │  │ proj:{id}           │◄───┼── User (web)
                   │  │ (user↔orchestrator) │◄───┼── Orchestrator CLI
                   │  └─────────────────────┘    │
                   │  ┌─────────────────────┐    │
                   │  │ proj:{id}:agent:1   │◄───┼── Orchestrator CLI
                   │  │ (orch↔agent-1)      │◄───┼── Agent-1 CLI
                   │  └─────────────────────┘    │
                   │  ┌─────────────────────┐    │
                   │  │ proj:{id}:agent:2   │◄───┼── Orchestrator CLI
                   │  │ (orch↔agent-2)      │◄───┼── Agent-2 CLI
                   │  └─────────────────────┘    │
                   └────────────────────────────┘
```

## Message Flow

```
User types goal in web UI
  → chat:message { roomId: "proj:123", role: "user", content: "Build me X" }
    → Server persists + broadcasts to room
      → Orchestrator receives message
        → Uses Claude to decompose into 2 tasks
          → emit agent:spawned { agentId: "agent-1" }  ← server creates room proj:123:agent:1
          → spawn onezone-agent subprocess (connects to proj:123:agent:1)
          → emit agent:spawned { agentId: "agent-2" }  ← server creates room proj:123:agent:2
          → spawn onezone-agent subprocess (connects to proj:123:agent:2)
          → chat:message to proj:123:agent:1 { role: "orchestrator", content: "Task A" }
          → chat:message to proj:123:agent:2 { role: "orchestrator", content: "Task B" }
            → Agent-1 runs Claude, streams replies to proj:123:agent:1
            → Agent-2 runs Claude, streams replies to proj:123:agent:2
            → agent:done from each agent
              → Orchestrator synthesizes result
                → chat:message to proj:123 { role: "orchestrator", content: "Done! Here's the result..." }
                  → User sees reply in web UI
```

## Tech Stack

| Package | Version |
|---|---|
| `@nestjs/core` | 11.x |
| `@nestjs/websockets` + `@nestjs/platform-socket.io` | 11.x |
| `socket.io` / `socket.io-client` | 4.x |
| `@oclif/core` | 4.x |
| `claude` (Claude Code CLI, installed globally) | latest |
| `next` | 15.x |
| `drizzle-orm` + better-sqlite3 | latest |
| `turbo` | 2.x |
| `zod` | 3.x |
| Node.js | 22 (ESM throughout) |
