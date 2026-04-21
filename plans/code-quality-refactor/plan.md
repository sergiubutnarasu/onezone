# Code Quality & SOLID Refactoring

**Branch:** `refactor/code-quality-solid`
**Description:** Improve codebase structure, eliminate duplication, enforce SOLID principles, and establish type-safe message handling across all layers.

## Goal
The codebase has several structural and quality issues: a 400-line god-class gateway, duplicated socket lifecycle code in the agent, type-unsafe message handling with 8+ optional fields, and 10+ repeated error-handling patterns in the frontend API layer. This plan refactors each layer systematically — from shared types down to UI hooks — so each change builds cleanly on the previous one.

---

## Implementation Steps

### Step 1: Foundation — Type Safety & Protocol Constants
**Files:**
- `packages/shared/src/types.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/constants.ts` *(new)*
- `packages/shared/src/index.ts`

**What:**
Replace the flat `RoomMessage` interface (8+ optional fields) with a discriminated union type so TypeScript can exhaustively check message variants at compile time. Extract socket event names into a `SOCKET_EVENTS` constant object and create a `createTaskRoomId(taskId)` / `extractTaskId(roomId)` helper pair to eliminate the `task:${taskId}` string construction that currently appears in 3+ files. Sync the `HEARTBEAT_INTERVAL_MS` and `STALE_THRESHOLD_MS` values into shared constants (currently duplicated between `agents.service.ts` and `listen.ts` with a comment warning they must match).

Extract the shared `name + description` fields from `CreateProjectSchema` and `CreateTaskSchema` into a `baseEntitySchema` to eliminate the repeated Zod definition.

**Concerns:**
- Changing `RoomMessage` will cause type errors in all consumers — that's intentional and guides Step 2–5.
- The discriminated union must cover every variant the server currently emits to avoid gaps.

**Testing:** `pnpm build` across all packages succeeds. Type errors from consuming files are expected and will be resolved in subsequent steps.

---

### Step 2: Server — Decompose ChatGateway
**Files:**
- `apps/server/src/gateways/chat.gateway.ts`
- `apps/server/src/gateways/socket-auth.guard.ts` *(new)*
- `apps/server/src/gateways/message-handlers/` *(new directory)*
  - `chat-message.handler.ts`
  - `output-line.handler.ts`
  - `command-start.handler.ts`
  - `command-exit.handler.ts`
  - `message-handler.interface.ts`
- `apps/server/src/gateways/constants.ts`
- `apps/server/src/gateways/gateways.module.ts`

**What:**
Split the 400-line `ChatGateway` god class (5 responsibilities) into focused units:

1. **`SocketAuthGuard`** — Moves authentication/validation of the socket handshake payload out of `handleConnection` into a guard. Removes the raw `as Exclude<MessageRole, MessageRole.System>` type cast by using a proper Zod-refined type.

2. **`IMessageHandler` interface + per-type handlers** — Implement the Open/Closed Principle: each message type (`chat:message`, `output:line`, `agent:command:start`, `agent:command:exit`) lives in its own handler class. The gateway calls `handler.handle(data)` via a `Map<string, IMessageHandler>` registry rather than four hard-coded `@SubscribeMessage` methods that cannot be extended without modification.

3. **`AgentSocketMeta` / `UserSocketMeta` discriminated union** — Replace the single `AgentSocketMeta` interface (which mixed optional agent + user fields) with separate, narrowed types to satisfy the Interface Segregation Principle.

4. **Keep `ChatGateway` as a thin orchestrator** — It handles `handleConnection` / `handleDisconnect` by delegating to extracted helper methods (`connectAgent`, `connectUser`). It delegates each socket event to the handler registry.

5. **Use `SOCKET_EVENTS` constants** from shared package instead of magic strings.

**Concerns:**
- NestJS DI must be wired correctly for each new handler class.
- The `socketMeta` Map should remain private to the gateway; handlers receive what they need via parameters.
- Error handling strategy: gateway emits `'error'` event to client AND logs — do not throw from handlers.

**Testing:** Start server, connect an agent via CLI, verify messages are persisted and visible in the UI. All existing behavior unchanged.

---

### Step 3: Agent — Decompose Listen Command
**Files:**
- `apps/agent/src/commands/listen.ts`
- `apps/agent/src/lib/agent-registration.ts` *(new)*
- `apps/agent/src/lib/task-socket.ts` *(new)*
- `apps/agent/src/lib/socket-client.ts`

**What:**
Decompose the 240-line `Listen` command (5 responsibilities) into single-responsibility modules:

1. **`AgentRegistrationClient`** (`lib/agent-registration.ts`) — Owns the HTTP `POST /agents/register` call. Accepts `serverUrl`, `name`, `hostname`. Returns `agentId`. Isolated, testable without socket setup.

2. **`TaskSocketConnection`** (`lib/task-socket.ts`) — Encapsulates the full socket lifecycle for a task room: connect, heartbeat setup, error/disconnect handling, and cleanup. Eliminates the ~60 lines of identical lifecycle code currently duplicated between `connectToLobby()` and `connectToTask()`. Accepts a set of callbacks (`onOutput`, `onExit`, etc.) and handles all socket plumbing internally.

3. **`Listen.run`** becomes a thin orchestrator: registers agent, creates a `TaskSocketConnection`, and wires process output events to socket emissions.

4. Use `SOCKET_EVENTS` and `createTaskRoomId` constants from shared package.

**Concerns:**
- The `stderrBuffer` pattern (buffer stderr, only emit on failure) must be preserved exactly — it's intentional behavior.
- The process kill group (`process.kill(-pid, 'SIGTERM')`) must remain correct after extraction.
- `HEARTBEAT_INTERVAL_MS` and `STALE_THRESHOLD_MS` should be imported from shared constants (Step 1).

**Testing:** `node bin/dev.js listen --name test-agent --server http://localhost:5026` connects, heartbeats every 30s, runs assigned tasks, emits output, and cleans up on disconnect.

---

### Step 4: Web — HTTP Client & API Layer
**Files:**
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/http-client.ts` *(new)*

**What:**
Create a small `httpClient` utility that wraps `fetch` and centralizes:
- Response `ok` check (eliminates the 10+ identical `if (!res.ok) throw new Error(...)` blocks)
- JSON parsing
- Base URL resolution from `NEXT_PUBLIC_API_URL`

Rewrite `api.ts` functions to delegate to `httpClient.get<T>()` / `httpClient.post<T>()` / `httpClient.patch<T>()` / `httpClient.delete<T>()`. Each API function becomes 1–3 lines.

**Concerns:**
- Do not add retry logic or interceptors — YAGNI. Keep it a thin wrapper.
- Error message should include the HTTP status code so callers can distinguish failure modes if needed.
- Do not change the public API of `api.ts` — all callers remain unchanged.

**Testing:** Create a project, rename it, create a task, drag task between columns — all operations succeed and errors surface correctly.

---

### Step 5: Web — Hook Decomposition & buildChatItems
**Files:**
- `apps/web/src/hooks/useTaskRoom.ts`
- `apps/web/src/hooks/useSocketConnection.ts` *(new)*
- `apps/web/src/hooks/useConnectedAgents.ts` *(new)*
- `apps/web/src/app/projects/[id]/tasks/[taskId]/page.tsx`

**What:**
1. **Decompose `useTaskRoom`** (185 lines, 5 responsibilities) into:
   - `useSocketConnection(url, roomId)` — manages connect/disconnect lifecycle, returns the socket instance
   - `useConnectedAgents(socket)` — tracks `agent:connected` / `agent:disconnected` events, returns agent list
   - `useTaskRoom(taskId)` — reduced to: compose the two above + manage messages state using `useReducer` (replacing the mixed `useState` + `setMessages(prev => ...)` / `setMessages(msgs)` patterns)

2. **Simplify `buildChatItems`** in `page.tsx` — the 48-line function with 4-level nesting becomes readable once the discriminated union types from Step 1 let TypeScript narrow each branch. Extract `handleCommandGroup`, `handleOutputLine`, and `handleCommandExit` as pure functions.

3. Use `SOCKET_EVENTS` constants from shared package for all event subscriptions.

**Concerns:**
- The synthetic exit message generation (created when a command-start has no matching exit in state) must be preserved.
- Socket cleanup in `useEffect` return must remain correct to prevent memory leaks.
- Verify the `useReducer` refactor produces identical state transitions to the original `useState` logic before removing old code.

**Testing:** Open a task, run a command via agent, verify output streams in real-time, verify exit code appears, verify agent connected/disconnected status updates.

---

## Concerns Summary (Cross-cutting)

| Concern | Resolution |
|---|---|
| Changing `RoomMessage` will break all consumers | Intentional — type errors guide the work. Step 1 first, then fix consumers in order. |
| NestJS DI with multiple handler classes | Each handler is `@Injectable()`, registered in `GatewaysModule.providers` |
| Shared constants introduce a new export from `@onezone/shared` | `index.ts` updated in Step 1; all apps already import from that package |
| Socket lifecycle extraction must preserve all edge cases | TaskSocketConnection has unit tests for heartbeat, error, and disconnect paths |
| `buildChatItems` refactor must be behavior-identical | Covered by manual end-to-end test: full command execution with stdout + stderr + exit |
