# acpx Adapter — Replace Per-Agent SDKs with a Single ACP Client

**Date:** 2026-08-11
**Status:** Approved design (pending implementation plan)

## Problem

`apps/terminal` currently has three agent adapters, each built on a different
vendor SDK:

| Adapter | SDK | File |
| --- | --- | --- |
| Claude Code | `@anthropic-ai/claude-agent-sdk` | `apps/terminal/src/agents/claude.ts` |
| GitHub Copilot CLI | `@github/copilot-sdk` | `apps/terminal/src/agents/copilot.ts` |
| OpenCode | `@opencode-ai/sdk` | `apps/terminal/src/agents/opencode.ts` |

Each SDK has its own event model, lifecycle, and config surface. Adding a new
agent means writing a new adapter against a new SDK. The dependency surface is
large and vendor-specific.

## Goal

Consolidate all three adapters into a single interface backed by the open
[Agent Client Protocol (ACP)](https://agentclientprotocol.com), via the
[`acpx`](https://github.com/openclaw/acpx) headless ACP client. This:

- Replaces 3 vendor SDKs with 1 ACP client.
- Makes adding new agents (codex, gemini, etc.) a config change, not a new adapter.
- Reduces the dependency surface / bundle size.
- Standardizes on the open ACP protocol.

## Decisions (confirmed with user)

1. **Invocation:** spawn `acpx` as a subprocess CLI (`exec --format json --json-strict`), parse NDJSON ACP events. Not the embedded runtime.
2. **Scope:** replace all three adapters at once.
3. **BYOK:** keep it. acpx passes ambient provider env vars through to child agents, so existing `ANTHROPIC_*`, `COPILOT_PROVIDER_*`, `OPENCODE_PROVIDER_*` env vars flow through unchanged.
4. **RTK:** drop the `rtk hook claude` PreToolUse hook. Remove RTK from the entrypoint.
5. **acpx install:** global install in the Dockerfile (`npm install -g acpx@latest`), matching the existing `opencode-ai` pattern. Spawn `acpx` from PATH.
6. **Skills:** copy skills into the **workdir** (where the agent runs, `cwd`), so agent CLIs auto-discover them. The config folder is **no longer used for skills** — including for custom prompts and custom skills. This is required because acpx's CLI has no `additionalDirectories`/`skillDirectories` flag, so skills must live where the agent naturally looks (the workdir).
7. **Config folder removed entirely:** the `config/` folder is eliminated. All per-project agent config (`.claude/`, `.github/`, `.opencode/`, `.agents/`) moves into the **workdir**. `getProjectConfigFolder`/`createProjectConfigFolder` and the `setup*Config` helpers are removed; the workdir is the single source of truth for everything.

## Architecture

```
setup.ts (AgentTag → acpx agent name)
   └─ acpx.ts  (single adapter)
        └─ spawn: acpx <agent> exec --format json --json-strict "<prompt>"
             └─ parse NDJSON ACP messages → AgentEvent stream
```

### Component: `apps/terminal/src/agents/acpx.ts` (new)

A single adapter that replaces `claude.ts`, `copilot.ts`, and `opencode.ts`.

- **Spawn:** `spawn("acpx", [agentName, "exec", "--format", "json", "--json-strict", prompt], { cwd, env })`. `exec` is one-shot (no saved session), matching the current per-task fresh-run behavior.
- **Parse:** read stdout line-by-line. Each line is a raw ACP JSON-RPC message. Map to the existing `AgentEvent` shape:
  - `session/update` with `agent_message_chunk` (type `text`) → `AgentEventType.Text` (streaming partial text — confirmed preserved by acpx `json` format)
  - `session/update` with `agent_message_chunk` (type `thinking`) → `Text` (thinking block)
  - `session/update` with `agent_message` (full) → `Text` + `Usage`
  - `session/update` with `tool_call` / `tool_call_update` → `Text` (tool_use block)
  - `session/update` with `tool_call_result` → `Text` (tool_result block)
  - `session/update` with `agent_message` containing `stopReason` → `Result` (with usage/cost, `nextColumnId` via `parseNextColumnTag`)
- **Abort:** on `signal.abort`, kill the child process (SIGTERM → SIGKILL fallback).
- **Stderr:** forward to `AgentEventType.Stderr`. With `--json-strict`, stderr stays quiet except real errors.
- **Env:** forward `process.env` (BYOK vars pass through to child agents).

### Component: `apps/terminal/src/agents/setup.ts` (modify)

Map `AgentTag` → acpx agent name:

- `AgentTag.ClaudeCode` → `"claude"`
- `AgentTag.GithubCopilotCLI` → `"copilot"`
- `AgentTag.Opencode` → `"opencode"`

Add a lookup table so new agents (codex, gemini) are just a new enum value + map entry.

### Component: `apps/terminal/src/agents/claude.ts`, `copilot.ts`, `opencode.ts` (delete)

Removed. Their logic is subsumed by `acpx.ts`.

## Config folder removal (everything → workdir)

The `config/` folder is eliminated. All per-project agent config and skills move
into the **workdir**, which is the single source of truth. This is required
because acpx's CLI exposes no `additionalDirectories`/`skillDirectories` flag, so
the agent CLI must find everything where it runs (`cwd` = workdir).

### Target layout (after)

```
~/.onezone/projects/<projectId>/
└── workdir/         ← agent runs here (cwd); all config + skills live here
    ├── .claude/         (settings + skills)
    ├── .github/         (skills)
    ├── .opencode/       (skills)
    ├── .agents/         (skills)
    └── .worktrees/      (per-task worktrees)
```

### Files to change

- **`apps/terminal/src/lib/project-paths.ts`**
  - Remove `getProjectConfigFolder` and `createProjectConfigFolder`.
  - `setupClaudeConfig`, `setupCopilotConfig`, `setupOpencodeConfig`: retarget
    from `config/...` to `workdir/...` (or fold into workdir setup).
  - `getSkillsDirs`: base on `getProjectWorkDir(projectId)`.
  - `getAllInstalledSkills`, `removeSkill`: unchanged logic, resolve via the
    updated `getSkillsDirs` (workdir-based).
- **`apps/terminal/src/lib/skills.ts`**
  - `getSkillDirs`: base on the workdir.
  - `setupSkills`: use the workdir for skill-exists checks.
  - `runSkillCommand`: run `npx skills add --copy` with `cwd` = workdir so custom
    skills land in the workdir.
- **`apps/terminal/src/lib/setup.ts`**
  - Remove the "Checking config folder..." step and `createProjectConfigFolder`
    call.
  - The `setup*Config` calls now target the workdir.
- **`apps/terminal/src/lib/project-builder-command-runner.ts`**
  - Remove `createProjectConfigFolder`; `setup*Config` target the workdir.
- **`apps/terminal/src/agents/claude.ts`, `copilot.ts`, `opencode.ts`**: deleted
  (their explicit config/skill wiring disappears with them).

### Custom prompts / custom skills

The workdir is the single source of truth. Custom skills installed via
`npx skills add --copy` and the bundled `onezone-*` skills both land in the
workdir, so they are discovered by the agent CLI regardless of how the prompt is
invoked (task, custom prompt, etc.). The config folder is not consulted
anymore.

## Dependency changes

`apps/terminal/package.json`:
- Remove `@anthropic-ai/claude-agent-sdk`, `@github/copilot-sdk`, `@opencode-ai/sdk`.
- Do **not** add `acpx` as a dependency (global install instead).

## Docker / compose changes

### `apps/terminal/Dockerfile`

Add global install of acpx alongside the existing `opencode-ai` install:

```dockerfile
# Install acpx (ACP client)
RUN npm install -g acpx@latest
```

Node is `node:22-trixie-slim` (≥22.13), satisfying acpx's requirement.

### `apps/terminal/docker-entrypoint.sh`

Remove the RTK setup:

```sh
# Remove:
mkdir -p /home/agent/.claude
rtk init -g --auto-patch
```

Keep the `.claude` dir creation if still needed for Claude config persistence.

### `docker-compose.yml`

The `terminal` service already forwards all BYOK env vars (`ANTHROPIC_*`, `COPILOT_PROVIDER_*`, `OPENCODE_PROVIDER_*`). No new env vars needed for acpx. Optionally add a `terminal_acpx` volume for `~/.acpx` session state persistence.

## Error handling

- **Spawn failure** (acpx not found): yield `AgentEventType.Stderr` with the error, return.
- **Non-zero exit:** acpx exit codes map to failures (`1` runtime, `3` timeout, `5` permission denied, `130` interrupted). Surface the code in a `Stderr` event.
- **Abort:** kill child, emit nothing further.
- **Malformed NDJSON line:** skip and continue (log to stderr).

## Testing

- Unit-test the NDJSON → `AgentEvent` mapping with fixture ACP messages (chunk, thinking, tool_call, tool_call_result, result).
- Unit-test the `AgentTag` → agent-name map.
- Unit-test config-folder removal: `getSkillsDirs`/`getAllInstalledSkills`/`removeSkill` resolve against the workdir, `setup*Config` copy into the workdir, and no code references `getProjectConfigFolder`/`createProjectConfigFolder`.
- Integration/pilot: run one task per agent (claude, copilot, opencode) through the new adapter and verify streaming text, usage, result, BYOK, and skills discovery reach the UI.

## Risks / open verification (pilot)

- **BYOK per-adapter env contract:** verify `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN` (claude), `COPILOT_PROVIDER_*` (copilot), `OPENCODE_PROVIDER_*` (opencode) are honored by the acpx-wrapped CLIs.
- **Config/skills discovery in workdir:** confirm each agent CLI discovers config and skills from `workdir/.claude`, `workdir/.github`, `workdir/.opencode` through the acpx path, and that custom skills installed via `npx skills add --copy` land in the workdir.
- **Streaming fidelity:** confirm partial text chunks arrive (acpx `json` emits `agent_message_chunk`), matching current UI behavior.
- **acpx pre-1.0:** CLI/runtime interfaces are evolving; pin the global install version in the Dockerfile for reproducibility.

## Out of scope

- Adding new agents (codex, gemini) — future work, enabled by this design.
- Switching to the embedded `acpx/runtime` library.
- Migrating the web/server apps (terminal-only change).
