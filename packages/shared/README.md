# @onezone/shared

Shared TypeScript types, Zod validation schemas, and Socket.io event constants used by all OneZone packages. Published as both ESM and CommonJS so it works in the NestJS server (CJS) and Next.js web app (ESM) without configuration.

## Contents

### Types (`src/types.ts`)

- **`EventCommands`** — Socket.io event name enum (`chat:message`, `output:line`, `terminal:connected`, etc.)
- **`MessageRole`** — `user | terminal | system`
- **`MessageStream`** — `stdout | stderr`
- **`MessageType`** — `CHAT | COMMAND_START | COMMAND_EXIT`
- **`AgentTag`** — `claude-code | copilot-cli`
- **`ProjectInfo`**, **`Task`**, **`Agent`**, **`KanbanColumn`**, **`ProjectSkill`** — shared domain interfaces

### Schemas (`src/schemas.ts`)

Zod schemas used for request/input validation across the stack:

| Schema | Purpose |
|---|---|
| `CreateProjectSchema` | Validates project creation payloads |
| `CreateTaskSchema` | Validates task creation payloads |
| `SocketAuthSchema` | Validates WebSocket handshake auth objects |

### Constants (`src/constants.ts`)

- `BACKLOG_COLUMN_ID` — sentinel ID for the virtual "Backlog" column
- `COMPLETED_COLUMN_ID` — sentinel ID for the virtual "Completed" column

## Development

```bash
# Watch mode (ESM output)
pnpm dev

# Build ESM + CJS
pnpm build

# Type-check only
pnpm typecheck
```

## Publishing

This package must be published before `@onezone/terminal`.

```bash
# From repo root
pnpm build
npm login
pnpm publish --filter @onezone/shared
```

## Usage

```ts
import { EventCommands, AgentTag, CreateProjectSchema } from "@onezone/shared";
```
