# Agent List Command

**Branch:** `feat/agent-list-command`
**Description:** Add a `agents list` CLI command that fetches all agents from the server and displays their ID and connection status.

## Goal
The agent CLI needs a way to inspect what agents are registered on the server. A new `agents list` command will call `GET /agents` and render a formatted table showing each agent's ID and connected/disconnected status.

## Implementation Steps

### Step 1: Add `agents/list` command
**Files:** `apps/agent/src/commands/agents/list.ts`
**What:** Create a new oclif command at `src/commands/agents/list.ts`. oclif automatically maps the file path to the command name `agents list`. The command will:
- Accept an optional `--server` flag (default `http://localhost:5026`) matching the pattern in `listen.ts`
- Call `GET {server}/agents` using native `fetch()`
- Deserialize the response as `Agent[]` (type already exported from `@onezone/shared`)
- Print a formatted table to stdout: columns `ID`, `Name`, `Status` (using `this.log()`)

**Testing:** Run `pnpm dev agents list` from `apps/agent/`. Verify the command lists agents with their IDs and `connected`/`disconnected` status. Test with `--server http://localhost:5026` flag explicitly as well.
