# @onezone/terminal

The Onezone terminal CLI is an oclif-based worker and utility client. It authenticates through the server, registers a machine as a terminal, listens for assigned tasks over Socket.io, runs the selected agent CLI, streams output back to the task chat, and reports command exit status and usage metadata.

## Installation

From the monorepo:

```bash
pnpm install
pnpm build
pnpm --filter @onezone/terminal dev --help
```

From npm:

```bash
npm install -g @onezone/terminal
onezone-terminal --help
```

Run without installing globally:

```bash
npx @onezone/terminal --help
```

## Authentication

The CLI uses the Onezone device-code flow.

```bash
onezone-terminal login --server http://localhost:5026
onezone-terminal whoami --server http://localhost:5026
onezone-terminal logout --server http://localhost:5026
```

`login` prints a user code and a web activation URL. After approval in the browser, tokens are stored in the OS keychain through `@napi-rs/keyring`. If no keychain is available, the CLI falls back to `~/.onezone/tokens.json` with file mode `0600`.

## Listening For Tasks

```bash
onezone-terminal listen
onezone-terminal listen --name my-dev-box
onezone-terminal listen --server https://api.example.com --name ci-runner-1
```

| Flag | Default | Description |
|---|---|---|
| `--server` | `http://localhost:5026` | Onezone server URL |
| `--name` | machine hostname | Unique terminal name for the authenticated user |

The listener registers the terminal, joins the lobby, receives `terminal:assign-task` events, connects to each task room, executes the configured runner, streams stdout/stderr, sends heartbeats, and reconnects if the lobby connection drops.

## Commands

| Command | Description |
|---|---|
| `onezone-terminal login` | Authenticate through the device-code flow |
| `onezone-terminal logout` | Revoke and clear local credentials |
| `onezone-terminal whoami` | Show the authenticated user |
| `onezone-terminal listen` | Register this machine and listen for assigned work |
| `onezone-terminal task create` | Create a task from the CLI |
| `onezone-terminal task list` | List tasks |
| `onezone-terminal task view` | Show task details |
| `onezone-terminal task move` | Move a task to another kanban column |
| `onezone-terminal task delete` | Delete a task |
| `onezone-terminal column list` | List kanban columns |
| `onezone-terminal column view` | Show column details |
| `onezone-terminal terminals list` | List registered terminals |

Run any command with `--help` for flags and examples.

## Agent Runners

When a task is assigned, the terminal selects a runner from the task agent tag.

| Agent tag | Expected runner |
|---|---|
| `claude-code` | Claude Code CLI |
| `github-copilot-cli` | GitHub Copilot CLI |

The terminal host is responsible for installing and authenticating any agent CLI it is expected to run. In Docker, `docker-entrypoint.sh` installs Claude Code, `uv`, and RTK when missing, initializes RTK's Claude hook config, prepares SSH defaults, authenticates to Onezone if needed, and starts `onezone-terminal listen`.

Useful runtime variables for the Docker terminal include:

| Variable | Default | Description |
|---|---|---|
| `TERMINAL_NAME` | `Onezone Docker Terminal` | Name registered with the server |
| `TERMINAL_SERVER_URL` | `http://server:5026` | Server URL from inside Compose |
| `ANTHROPIC_AUTH_TOKEN` | none | Optional Claude-compatible auth token |
| `ANTHROPIC_BASE_URL` | none | Optional Claude-compatible API base URL |
| `ANTHROPIC_API_KEY` | none | Optional Claude-compatible API key |

## Development

```bash
pnpm --filter @onezone/terminal dev --help
pnpm --filter @onezone/terminal dev login --server http://localhost:5026
pnpm --filter @onezone/terminal dev listen --server http://localhost:5026 --name local-dev
pnpm --filter @onezone/terminal typecheck
```

Dev mode uses `bin/dev.js` with `ts-node/esm`, so no separate build is required for local CLI changes.

## Build And Publish

```bash
pnpm --filter @onezone/terminal build
```

The build runs TypeScript, copies static assets to `dist/static`, and generates the oclif manifest. Output lands in `dist`.

Publish `@onezone/shared` before publishing the terminal package:

```bash
pnpm build
npm login
pnpm publish --filter @onezone/shared
pnpm publish --filter @onezone/terminal
```

## Production Notes

- Run terminal workers on machines or containers that are intentionally allowed to execute agent commands.
- Isolate workers by project, trust boundary, or credential set when tasks may access different repositories or secrets.
- Keep SSH keys, cloud credentials, and provider tokens out of images; mount or inject them at runtime.
- Use a stable `--name` per worker so task assignment is predictable.
- Ensure the API URL supports WebSocket upgrades and is reachable from the worker.
- Monitor listener logs for reconnect loops, authentication failures, missing agent CLIs, and command exit codes.
