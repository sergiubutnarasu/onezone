# Agent Task CLI Command

**Branch:** `feat/agent-task-command`
**Description:** Add a `task` subcommand group to the agent CLI with `list`, `create`, and `status` subcommands backed by HTTP calls to the server.

## Goal
Allow operators to manage tasks from the agent CLI without opening the web UI. The three subcommands cover the core task lifecycle: listing tasks for a project, creating new tasks (optionally assigned to an agent), and updating a task's status.

## Implementation Steps

### Step 1: Add `task list` command
**Files:** `apps/agent/src/commands/task/list.ts`
**What:** Fetch `GET /projects/:projectId/tasks` and render a table of `id`, `name`, `status` columns, matching the table-formatting style used in `agents/list.ts`. Requires `--project` (UUID) and `--server` flags.
**Testing:** Run `pnpm dev task list --project <uuid>` against a running server; verify the table renders correctly and that a missing/invalid project returns a clean error message.

### Step 2: Add `task create` command
**Files:** `apps/agent/src/commands/task/create.ts`
**What:** POST to `POST /projects/:projectId/tasks` with `{ name, description?, agentId? }`. Requires `--project` and `--name` flags; optional `--description` and `--agent` (agent UUID) flags. Logs the created task's ID on success.
**Testing:** Run `pnpm dev task create --project <uuid> --name "My task"` and `pnpm dev task create --project <uuid> --name "My task" --agent <agentUuid>` and verify the task appears in `task list` output.

### Step 3: Add `task status` command
**Files:** `apps/agent/src/commands/task/status.ts`
**What:** PATCH `PATCH /tasks/:taskId/status` with `{ status }`. Requires `--task` (task UUID) and `--status` flags. The `--status` flag is constrained to the valid `TaskStatus` enum values (`BACKLOG`, `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `TESTING`, `DONE`). Logs confirmation on success.
**Testing:** Run `pnpm dev task status --task <uuid> --status IN_PROGRESS` and verify `task list` reflects the updated status. Run with an invalid status value and verify the flag validation error appears before any network call.
