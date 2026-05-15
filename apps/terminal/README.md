# @onezone/terminal

The OneZone terminal CLI. Built with [oclif](https://oclif.io/), it registers the local machine as a terminal with the OneZone server, listens for task assignments over Socket.io, and dispatches AI agents (Claude Code, GitHub Copilot CLI) to execute those tasks.

## Installation

```bash
# From repo root
pnpm install
pnpm build
```

Or install from npm:

```bash
npm install -g @onezone/terminal
# or run without installing
npx @onezone/terminal listen
```

Or link globally for local development:

```bash
cd apps/terminal
npm link
```

## Publishing

Publish `@onezone/shared` first, then this package:

```bash
# From repo root
pnpm build
npm login
pnpm publish --filter @onezone/shared
pnpm publish --filter @onezone/terminal
```

## Usage

### `onezone-terminal listen`

Registers this machine as a terminal and continuously listens for incoming task assignments.

```bash
onezone-terminal listen
onezone-terminal listen --name my-dev-box
onezone-terminal listen --server http://my-server:5026 --name ci-runner
```

**Flags**

| Flag | Default | Description |
|---|---|---|
| `--server` | `http://localhost:5026` | OneZone server URL |
| `--name` | machine hostname | Unique name for this terminal |

### Task commands

Manage tasks from the CLI:

```bash
onezone-terminal task create   # Create a new task
onezone-terminal task list     # List tasks
onezone-terminal task view     # View task details
onezone-terminal task move     # Move task to a different kanban column
onezone-terminal task delete   # Delete a task
```

### Column commands

```bash
onezone-terminal column        # Manage kanban columns
```

### Terminal commands

```bash
onezone-terminal terminals list   # List all registered terminals
```

## Agents

When a task is assigned, the terminal selects the right agent runner based on the task's agent tag:

| Agent tag | Runner |
|---|---|
| `claude-code` | Claude Code CLI |
| `copilot-cli` | GitHub Copilot CLI |

Agent processes are managed by `src/agents/` and supervised for exit codes and output streaming.

## Development

```bash
# Watch mode (TypeScript recompile on change)
pnpm dev

# Type-check only
pnpm typecheck
```

Dev mode uses `bin/dev.js` which loads via `ts-node/esm` so no separate build step is needed.

## Build

```bash
pnpm build   # tsc + copy static assets + oclif manifest
```

Output lands in `dist/`.
