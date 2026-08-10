# ACP Migration for the Claude Code Agent — Design

**Date:** 2026-08-10
**Status:** Draft for review
**Scope:** Migrate the Claude Code agent runner from `@anthropic-ai/claude-agent-sdk` to the Agent Client Protocol (ACP), using the native `@agentclientprotocol/sdk` and `@agentclientprotocol/claude-agent-acp` adapter.

---

## 1. Goal

Replace the direct `@anthropic-ai/claude-agent-sdk` call inside `apps/terminal/src/agents/claude.ts` with an ACP client that speaks to the Claude ACP adapter over stdio. The Claude **workflow** (kanban runner skills, memory, git worktree, `[[ONEZONE_NEXT_COLUMN:...]]` protocol) is prompt content and is **not** changed by this migration.

The broader intent is to unify all agents (Claude, Copilot, Opencode) behind one protocol and reduce vendor coupling — but this first phase migrates **only Claude**.

## 2. Non-goals

- Do NOT migrate Copilot or Opencode runners in this phase.
- Do NOT change any agent workflow skill content or the `AgentEvent`/`UnifiedContentBlock` contract.
- Do NOT re-implement the rtk token-compression hook (accepted as a known loss for now; see §7.1).
- Do NOT change the server (`apps/server`) — the model setting flows through the terminal runner.

## 3. Current architecture (verified)

- `apps/terminal/src/agents/claude.ts` implements `AgentConfig = { tag, run() }`.
- `run()` uses `query()` from `@anthropic-ai/claude-agent-sdk`, yielding a unified `AgentEvent` stream:
  - `AgentEventType.Text` — JSON array of `UnifiedContentBlock` (text / thinking / tool_use / tool_result).
  - `AgentEventType.Usage` — `inputTokens` / `outputTokens`.
  - `AgentEventType.Result` — final result text, `usage.totalCostUsd`, `nextColumnId` (parsed from `[[ONEZONE_NEXT_COLUMN:...]]`), `finished`.
  - `AgentEventType.Stderr` — errors.
- `command-runner.ts` consumes these events and streams them over socket.io; the web frontend only ever sees `UnifiedContentBlock`, never the SDK.
- Model per run comes from `setupTerminalAgent(payload)` → `getEffectiveTaskAgentAndModel(task)` and is passed into `setupClaude({ projectId, model })`.
- Seed models are custom (e.g. `kimi-k2.6:cloud`).

## 4. Target architecture

```
apps/terminal/src/agents/claude.ts  (rewritten)
        │  spawns over stdio
        ▼
@agentclientprotocol/claude-agent-acp  (the ACP agent)
        │  wraps internally
        ▼
@anthropic-ai/claude-agent-sdk         (unchanged, now behind ACP)
```

- Replace dependency `@anthropic-ai/claude-agent-sdk` (direct use) with:
  - `@agentclientprotocol/sdk` (official ACP TS client, v1.x)
  - `@agentclientprotocol/claude-agent-acp` (ACP adapter, Apache-2.0, under the ACP org)
- `@anthropic-ai/claude-agent-sdk` becomes a transitive dependency of the adapter rather than a direct dependency of the terminal.

## 5. ACP client flow (replaces `query()`)

The `run()` generator keeps its signature and event contract. Internally it performs:

1. **Spawn** the adapter child process (`node .../claude-agent-acp`, or via the `claude-code-acp` binary) with stdio transport, passing the environment.
2. **`initialize`** — negotiate protocol version + client capabilities.
3. **`session/new`** with:
   - `cwd` = project workdir
   - `additionalDirectories` = `[configPath]` (gated on `sessionCapabilities.additionalDirectories`)
   - `_meta.claudeCode.options.settings.model` = the run's model (see §6)
   - MCP servers (initially empty)
4. **`session/prompt`** — send the task prompt.
5. **Consume `session/update` notifications** and translate into `AgentEvent`s:
   - `agent_message_chunk` → `UnifiedContentBlock` text / thinking
   - `tool_call` / `tool_call_update` → tool_use / tool_result blocks
   - `usage_update` → `AgentEventType.Usage` (`used`/`size`) and cost
   - `config_option_update` → optionally reflect model changes
6. **`session/cancel`** on `AbortSignal`.
7. On prompt completion (`stopReason: "end_turn"`), yield `AgentEventType.Result` with the final text and parsed `nextColumnId`.

### Permission handling

The current `settings.permissions.allow` list (Bash/Edit/Read/Write/Glob/Grep/WebSearch/WebFetch/Agent/TodoWrite) maps to an ACP `session/request_permission` handler that **auto-responds "allow"** to match today's behavior (the workdir is already OS-sandboxed).

### Sandbox

The current `sandbox.filesystem.allowWrite/allowRead` maps to ACP `cwd` (workdir) + `additionalDirectories` (config path). No client-side `fs` capability is needed since the agent does its own file ops within the cwd root set.

## 6. Model selection via `_meta` (chosen approach)

Model is passed **per session-create** via the ACP `_meta` field, in the shape the adapter expects (verified in adapter source `src/tests/create-session-options.test.ts`):

```ts
// params of session/new
{
  cwd: workDir,
  mcpServers: [],
  _meta: {
    claudeCode: {
      options: {
        settings: {
          model: "kimi-k2.6:cloud",  // the run's effective model
        },
      },
    },
  },
}
```

Precedence (from adapter docs `docs/model-configuration.md`):
1. `_meta.claudeCode.options.settings` (caller) — **highest**, used if present.
2. `CLAUDE_MODEL_CONFIG` env var — fallback, ignored when the caller provides settings.

Rationale for `_meta` over `CLAUDE_MODEL_CONFIG`:
- Highest precedence and explicit per-run, which matches Onezone's existing per-run model selection (`getEffectiveTaskAgentAndModel`).
- Avoids a deployment-level global that would be shared across parallel runs with different models.
- The `settings` object is the full Claude Agent SDK `Settings` type, so future needs (permissions, other options) can be added in the same object.

Provider routing (BYO endpoint for `kimi-k2.6:cloud`) is configured via environment variables on the adapter child process (e.g. `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN`), since the generic ACP `providers/*` methods remain draft RFDs.

## 7. Risks and open questions

### 7.1 rtk token-compression hook (known loss)
The current `PreToolUse` Bash hook runs `rtk hook claude` to compress command output (~60–90% token savings). ACP has **no hook API**. Options for a future phase:
- Client-side `terminal` capability: the agent executes Bash in a client-managed terminal; that interception point is where compression could be re-applied.
- Pre/post-processing tool results in the client.
Deferred by decision; flagged as the main functional tradeoff.

### 7.2 Model validation is enforced by the adapter
`set_config_option` (and by extension the settings `model`) is validated against advertised models. For a custom model we pass it directly via `_meta.claudeCode.options.settings.model`; the adapter maps settings to the SDK `Settings` type. We must confirm at implementation time that a custom model ID passed via settings is accepted (the tests show full-ID values like `claude-sonnet-4-6` are accepted). If a custom model is rejected, fall back to `CLAUDE_MODEL_CONFIG` `availableModels` (accepts full IDs) or `modelOverrides`.

### 7.3 Generic provider config not stabilized
`providers/list` / `providers/set` remain draft RFDs. Provider routing stays env-based for now.

### 7.4 Adapter maturity / dependency
The adapter moved from Zed to the ACP org (`@agentclientprotocol/claude-agent-acp`, v0.66, ~2.4k stars, Apache-2.0). It is third-party relative to Anthropic, though it wraps the official SDK. Verify version pinning and the spawn command (`claude-code-acp` binary vs `node dist/index.js`).

### 7.5 ACP v2 is draft
v1 is stable and sufficient. Monitor v2 (session resume/replay) but do not block on it.

## 8. Testing

- **Unit**: adapter-mapping tests in `apps/terminal/src/agents/claude.test.ts` verifying ACP notifications → `AgentEvent` translation (text, thinking, tool_call, tool_result, usage, result/nextColumnId).
- **Integration**: run the adapter in-process against a mocked/fake ACP agent to exercise session lifecycle, cancellation, and `_meta` model passing.
- **Regression**: existing coverage for `AgentEvent`/`UnifiedContentBlock` shapes must remain green; the web frontend behavior is unchanged.
- Manual: one real kanban task run end-to-end with `kimi-k2.6:cloud` to confirm model selection + `[[ONEZONE_NEXT_COLUMN:...]]` signaling.

## 9. Success criteria

- `apps/terminal/src/agents/claude.ts` uses the ACP client; no direct `@anthropic-ai/claude-agent-sdk` import remains in the terminal.
- `AgentEvent`/`UnifiedContentBlock` contract unchanged; command-runner and web frontend untouched.
- Claude kanban tasks complete end-to-end (fetch → memory → worktree → execute → next-column tag) with the configured custom model.
- Cancellation (AbortSignal → `session/cancel`) works.
- Unit + integration tests pass.
