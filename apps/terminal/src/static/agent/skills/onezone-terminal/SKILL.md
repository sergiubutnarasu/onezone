---
name: onezone-terminal
description: "Use the onezone-terminal CLI to manage tasks, columns, and terminals in agent workflows. Use when you need to list, create, view, move, or delete tasks; inspect kanban columns; or query registered terminals. Triggers: 'list tasks', 'create a task', 'move task to column', 'check task status', 'onezone-terminal', 'project tasks'."
argument-hint: "project UUID or task action to perform"
license: MIT
metadata:
  author: Onezone
  version: "1.0"
---

# onezone-terminal CLI

The `onezone-terminal` binary is the CLI for interacting with the onezone server. Use it via `run_in_terminal` to manage tasks, columns, and terminals as part of agent workflows.

## Prerequisites

- The onezone server must be running (default: `http://localhost:5026`)
- The CLI must be installed: use the installed `onezone-terminal` binary
- All commands require a project UUID (get it from the user or a previous step)

## Command Reference

### Tasks

```sh
# List all tasks in a project
onezone-terminal task list --project <project-uuid> --server <serverUrl>

# View details of a specific task
onezone-terminal task view <task-uuid> --server <serverUrl>

# Create a new task (terminal must already exist)
onezone-terminal task create \
  --project <project-uuid> \
  --name "Task name" \
  --terminal <terminal-uuid> \
  [--description "Optional description"] \
  [--agent <agent-uuid>] \
  [--model <model-identifier>] \
  --server <serverUrl>

# Move a task to a kanban column
onezone-terminal task move --task <task-uuid> --column <column-uuid> --server <serverUrl>

# Move task back to backlog
onezone-terminal task move --task <task-uuid> --column backlog --server <serverUrl>

# Delete a task
onezone-terminal task delete <task-uuid> --server <serverUrl>
```

### Columns

```sh
# List kanban columns for a project (ordered by Index)
onezone-terminal column list --project <project-uuid> --server <serverUrl>

# View a specific column
onezone-terminal column view <column-uuid> --project <project-uuid> --server <serverUrl>
```

### Terminals

```sh
# List all registered terminals
onezone-terminal terminals list --server <serverUrl>
```

### Listen mode (long-running)

```sh
# Start this terminal as a worker that picks up assigned tasks
onezone-terminal listen [--name my-terminal]
```

## Common Workflows

### 1. Inspect project state

```sh
# Get all tasks and see which column they're in
onezone-terminal task list --project <uuid> --server <serverUrl>

# Get available columns to see valid move targets (ordered by Index)
onezone-terminal column list --project <uuid> --server <serverUrl>
```

### 2. Create and assign a task

```sh
# Find an available terminal first
onezone-terminal terminals list --server <serverUrl>

# Create the task bound to that terminal
onezone-terminal task create \
  --project <uuid> \
  --name "Implement feature X" \
  --terminal <terminal-uuid> \
  --server <serverUrl>
```

### 3. Progress a task through the board

```sh
# Get the column IDs (ordered by Index — higher index = later in the flow)
onezone-terminal column list --project <uuid> --server <serverUrl>

# Move task to "In Progress"
onezone-terminal task move --task <task-uuid> --column <in-progress-column-uuid> --server <serverUrl>

# Move task to "Done"
onezone-terminal task move --task <task-uuid> --column <done-column-uuid> --server <serverUrl>
```

## Flag Notes

- `--server` defaults to `http://localhost:5026` on all commands — always pass it explicitly using the `serverUrl` from the runner input to avoid hitting the wrong server
- `--project` is required for task list, task create, column list, and column view
- `--terminal` (for `task create`) accepts a terminal UUID from `terminals list`
- `--agent` (optional for `task create`) accepts an agent UUID — defaults to the project's default agent if omitted
- `--model` (optional for `task create`) accepts a model identifier — defaults to the project's default model if omitted
- `--column` (for `task move`) accepts either a UUID or the special keyword `backlog`

## Tips for Agents

- Always run `task list` before making changes so you have current task and column UUIDs
- Task IDs are UUIDs; copy them exactly from `task list` output
- If `terminals list` returns no terminals, prompt the user to run `onezone-terminal listen` in a terminal window first
- Use `task view <id>` to confirm a task's current state before moving it
