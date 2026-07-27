# @onezone/shared

Shared TypeScript contracts for the Onezone server, web app, and terminal CLI. The package publishes both ESM and CommonJS outputs so it can be consumed by Next.js, NestJS, and Node-based CLI code without app-specific shims.

## What It Contains

| File | Purpose |
|---|---|
| `src/types/` | Domain interfaces, enums, Socket.io event maps, task schedule types, notification types, pagination, and room message unions |
| `src/schemas.ts` | Zod schemas for shared input and Socket.io auth validation |
| `src/constants.ts` | Heartbeat constants and task/project room helper functions |
| `src/lib/room-ids.ts` | Room ID creation and extraction helpers |
| `src/lib/runner-payload.ts` | Runner prompt prefix and payload parsing utilities |
| `src/index.ts` | Public package exports |

## Core Types And Enums

- `AuthUser` for authenticated user identity and admin status.
- `EventCommands` for Socket.io event names, including chat, terminal command lifecycle, heartbeats, assignment, project-builder generation, notifications, and project cost updates.
- `MessageRole`, `MessageStream`, and `MessageType` for chat and command output records.
- `AgentTag` for supported runner tags: `claude-code`, `github-copilot-cli`, and `opencode`.
- `UnifiedContentBlock` and `ContentBlockKind` for normalized agent output consumed by the web frontend.
- `Agent`, `ProjectInfo` (including its `pending`/`ready`/`failed` `status`), `KanbanColumn`, `ProjectSkill`, `Task` and `TaskSchedule` (both with a `bypass` flag), `TaskDetails`, and `Terminal` for the main app resources.
- `ProjectBuilderCommandPayload`, `ProjectBuilderCommandStopPayload`, and `ProjectBuilderCommandFinishedPayload` for dispatching AI-assisted project/kanban board generation to a terminal.
- `TaskSchedule` and `CRON_PRESETS` for recurring task automation.
- `Notification` and `NotificationType` for notification inbox data.
- `ProjectStatistics` and related summary/row types for usage reporting.
- `RoomMessage` discriminated union for web task chat rendering.

## Socket Contracts

The package defines typed event maps for Socket.io clients and servers:

- `ServerToClientEvents`
- `ClientToServerEvents`

Important payloads include `AssignTaskPayload`, `CommandStartPayload`, `OutputLinePayload`, `CommandExitPayload`, and `ChatMessage`.

Room helpers in `src/lib/room-ids.ts` and runner payload utilities in `src/lib/runner-payload.ts` keep cross-package logic consistent:

```ts
import { createProjectRoomId, createTaskRoomId, extractTaskId, parseRunnerPayload } from "@onezone/shared";

const taskRoom = createTaskRoomId(taskId);
const projectRoom = createProjectRoomId(projectId);
const parsedTaskId = extractTaskId(taskRoom);
const payload = parseRunnerPayload(commandString);
```

## Schemas

| Schema | Purpose |
|---|---|
| `CreateProjectSchema` | Validates project creation input |
| `CreateTaskSchema` | Validates task creation input |
| `SocketAuthSchema` | Validates Socket.io handshake auth for user and terminal clients |

## Constants

| Constant | Description |
|---|---|
| `BACKLOG_COLUMN_ID` | Sentinel ID for the virtual Backlog column |
| `COMPLETED_COLUMN_ID` | Sentinel ID for the virtual Completed column |
| `HEARTBEAT_INTERVAL_MS` | Terminal heartbeat interval, currently `5000` ms |
| `STALE_THRESHOLD_MS` | Staleness threshold for disconnected terminals, currently `10000` ms |

## Usage

```ts
import {
  AgentTag,
  CreateProjectSchema,
  EventCommands,
  createTaskRoomId,
  type TaskDetails,
} from "@onezone/shared";
```

## Development

```bash
pnpm --filter @onezone/shared dev
pnpm --filter @onezone/shared build
pnpm --filter @onezone/shared typecheck
pnpm --filter @onezone/shared clean
```

The build emits ESM to `dist/esm` and CommonJS to `dist/cjs`, with package metadata written into each output folder.

## Publishing

Publish this package before publishing `@onezone/terminal` because the CLI depends on the shared contracts.

```bash
pnpm --filter @onezone/shared build
npm login
pnpm publish --filter @onezone/shared
```

## Contract Guidelines

- Treat exported event names and payload shapes as cross-package API contracts.
- Update server, web, terminal, and this README together when changing shared event payloads.
- Prefer adding explicit types or Zod schemas here when more than one package needs the same contract.
- Avoid importing app-specific code into this package; it should stay framework-neutral.
