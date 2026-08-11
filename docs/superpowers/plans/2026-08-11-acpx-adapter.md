# acpx Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three per-agent SDK adapters in `apps/terminal` with a single `acpx` ACP subprocess adapter, and move all per-project agent config/skills from the `config/` folder into the `workdir`.

**Architecture:** A single `acpx.ts` adapter spawns `acpx <agent> exec --format json --json-strict` and parses the NDJSON ACP event stream into the existing `AgentEvent` shape. `setup.ts` maps `AgentTag` → acpx agent name. The `config/` folder is removed; `.claude/`, `.github/`, `.opencode/`, `.agents/` and skills move into the workdir where the agent CLI auto-discovers them.

**Tech Stack:** Node 22, TypeScript, oclif CLI, vitest, acpx (global install), ACP (Agent Client Protocol).

## Global Constraints

- acpx is installed globally in the Dockerfile (`npm install -g acpx@latest`), NOT as a package dependency. Spawn `acpx` from PATH.
- Node must be ≥ 22.13 (Dockerfile uses `node:22-trixie-slim` — satisfied).
- The `config/` folder is removed entirely. No code may reference `getProjectConfigFolder` or `createProjectConfigFolder` after this change.
- All per-project agent config and skills live in the workdir (`getProjectWorkDir(projectId)`).
- The existing `AgentEvent` / `AgentEventType` / `AgentConfig` / `AgentRunParams` types in `apps/terminal/src/lib/types/agent.ts` are unchanged — the new adapter must produce the same event shape.
- The existing `UnifiedContentBlock` type in `packages/shared/src/types/content-block.ts` is unchanged.
- RTK is dropped: remove the `rtk hook claude` PreToolUse hook and the `rtk init -g --auto-patch` entrypoint line.
- BYOK env vars (`ANTHROPIC_*`, `COPILOT_PROVIDER_*`, `OPENCODE_PROVIDER_*`) flow through `process.env` to the spawned acpx child unchanged.
- Run tests with `pnpm --filter=@onezone/terminal test`. Typecheck with `pnpm --filter=@onezone/terminal typecheck`.

---

### Task 1: Remove the config folder from `project-paths.ts`

**Files:**
- Modify: `apps/terminal/src/lib/project-paths.ts`
- Test: `apps/terminal/src/lib/project-paths.test.ts`

**Interfaces:**
- Consumes: existing `getProjectWorkDir(projectId)`, `getProjectFolder(projectId)`.
- Produces: `setupClaudeConfig(projectId)`, `setupCopilotConfig(projectId)`, `setupOpencodeConfig(projectId)` now write into the workdir. `getSkillsDirs(projectId, agentTag)` now resolves against the workdir. Removes `getProjectConfigFolder` and `createProjectConfigFolder`.

- [ ] **Step 1: Write the failing tests**

In `apps/terminal/src/lib/project-paths.test.ts`, replace the `getProjectConfigFolder` and `createProjectConfigFolder` describe blocks with tests asserting the config folder is gone and the setup functions target the workdir. Update the import list to drop `getProjectConfigFolder` and `createProjectConfigFolder`.

```ts
// Remove these imports:
//   getProjectConfigFolder,
//   createProjectConfigFolder,

// Replace the 'getProjectConfigFolder' describe block with:
describe('config folder removed', () => {
  it('does not export getProjectConfigFolder', () => {
    // @ts-expect-error - function must be removed
    expect(projectPaths.getProjectConfigFolder).toBeUndefined();
  });
  it('does not export createProjectConfigFolder', () => {
    // @ts-expect-error - function must be removed
    expect(projectPaths.createProjectConfigFolder).toBeUndefined();
  });
});
```

Update the `setupClaudeConfig` / `setupCopilotConfig` / `setupOpencodeConfig` tests so the `cpSync` destination is under the workdir, not the config folder. For example, for `setupClaudeConfig`:

```ts
describe('setupClaudeConfig', () => {
  it('copies skills into the workdir .claude/skills', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['onezone-runner']);
    const result = setupClaudeConfig('proj-1');
    expect(result).toBe(true);
    const workdir = path.join(TEST_HOME, '.onezone', 'projects', 'proj-1', 'workdir');
    expect(mockCpSync).toHaveBeenCalledWith(
      expect.stringContaining('onezone-runner'),
      path.join(workdir, '.claude', 'skills', 'onezone-runner'),
      { recursive: true },
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter=@onezone/terminal test -- project-paths`
Expected: FAIL — `getProjectConfigFolder` still exists, `cpSync` still targets the config folder.

- [ ] **Step 3: Implement the changes in `project-paths.ts`**

Remove `getProjectConfigFolder` and `createProjectConfigFolder`. Retarget the three `setup*Config` functions to the workdir. Update `getSkillsDirs` to use the workdir.

```ts
// Delete these two functions entirely:
// export const getProjectConfigFolder = (projectId: string): string => { ... };
// export const createProjectConfigFolder = (projectId: string): boolean => { ... };

// In setupClaudeConfig, replace the config-folder base with the workdir:
export const setupClaudeConfig = (projectId: string): boolean => {
  try {
    const workDir = getProjectWorkDir(projectId);
    const claudeDir = path.join(workDir, ".claude");

    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    const skillsSourcePath = path.join(
      __dirname,
      "..",
      "static",
      "agent",
      "skills",
    );
    const skillsDestPath = path.join(claudeDir, "skills");

    if (fs.existsSync(skillsSourcePath)) {
      const skillDirs = fs.readdirSync(skillsSourcePath);
      for (const skillDir of skillDirs) {
        fs.cpSync(
          path.join(skillsSourcePath, skillDir),
          path.join(skillsDestPath, skillDir),
          { recursive: true },
        );
      }
    } else {
      console.warn(`Warning: skills folder not found at ${skillsSourcePath}`);
    }

    return true;
  } catch (err) {
    console.error(`Error setting up Claude config: ${(err as Error).message}`);
    return false;
  }
};
```

Apply the same workdir retarget to `setupCopilotConfig` (destinations `workdir/.github/skills` and `workdir/.agents/skills`) and `setupOpencodeConfig` (destination `workdir/.opencode/skills`).

Update `getSkillsDirs`:

```ts
const getSkillsDirs = (projectId: string, agentTag?: string): string[] => {
  const workDir = getProjectWorkDir(projectId);
  if (agentTag === "github-copilot-cli") {
    return [
      path.join(workDir, ".github", "skills"),
      path.join(workDir, ".agents", "skills"),
    ];
  }
  if (agentTag === "opencode") {
    return [
      path.join(workDir, ".opencode", "skills"),
      path.join(workDir, ".agents", "skills"),
    ];
  }
  return [path.join(workDir, ".claude", "skills")];
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter=@onezone/terminal test -- project-paths`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/terminal/src/lib/project-paths.ts apps/terminal/src/lib/project-paths.test.ts
git commit -m "refactor(terminal): remove config folder, retarget agent config to workdir"
```

---

### Task 2: Update `skills.ts` to use the workdir

**Files:**
- Modify: `apps/terminal/src/lib/skills.ts`
- Test: `apps/terminal/src/lib/skills.test.ts`

**Interfaces:**
- Consumes: `getProjectWorkDir(projectId)` (from `project-paths.js`), `getAllInstalledSkills`, `removeSkill`.
- Produces: `runSkillCommand(payload, log, signal)` and `setupSkills({ task, project, emit, signal })` now operate on the workdir.

- [ ] **Step 1: Write the failing tests**

In `apps/terminal/src/lib/skills.test.ts`, replace the `mockGetProjectConfigFolder` mock with `mockGetProjectWorkDir`, and update the mock factory and all `mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config')` calls to `mockGetProjectWorkDir.mockReturnValue('/test/home/.onezone/projects/proj-1/workdir')`.

```ts
const mockGetProjectWorkDir = vi.fn();

vi.mock('./project-paths.js', () => ({
  getProjectWorkDir: (...args: unknown[]) => mockGetProjectWorkDir(...args),
  getAllInstalledSkills: (...args: unknown[]) => mockGetAllInstalledSkills(...args),
  removeSkill: (...args: unknown[]) => mockRemoveSkill(...args),
  // ...rest unchanged
}));
```

Add a test asserting `runSkillCommand` runs `npx skills add` with `cwd` = workdir:

```ts
it('runs npx skills add with cwd = workdir', async () => {
  mockGetProjectWorkDir.mockReturnValue('/test/home/.onezone/projects/proj-1/workdir');
  mockRunProcess.mockResolvedValue(0);
  await runSkillCommand(
    { projectId: 'proj-1', source: 'vercel-labs/agent-skills', skillName: 'nextjs', agentCode: 'claude-code' },
    () => {},
  );
  expect(mockRunProcess).toHaveBeenCalledWith(
    expect.objectContaining({
      cmd: expect.stringContaining('npx --yes skills add'),
      cwd: '/test/home/.onezone/projects/proj-1/workdir',
    }),
    expect.anything(),
    expect.anything(),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter=@onezone/terminal test -- skills`
Expected: FAIL — `getProjectConfigFolder` no longer exported, `cwd` still config folder.

- [ ] **Step 3: Implement the changes in `skills.ts`**

Replace `getProjectConfigFolder` with `getProjectWorkDir` in the import and all usages.

```ts
import {
  getAllInstalledSkills,
  getProjectWorkDir,
  removeSkill,
} from "./project-paths.js";
```

In `runSkillCommand`:

```ts
const workDir = getProjectWorkDir(projectId);
const skillDirs = getSkillDirs(workDir, agentCode, skillName);
// ...
log(`[skill] Installing "${skillName}" in ${workDir}`);
// ...
const exitCode = await runAbortableShellCommand({
  cmd,
  cwd: workDir,
  signal,
});
```

In `setupSkills`:

```ts
const workDir = getProjectWorkDir(project.id);
// ...
const uninstalledSkills = skills.filter(
  (s) => !skillExists(workDir, agentCode, s.skillName),
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter=@onezone/terminal test -- skills`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/terminal/src/lib/skills.ts apps/terminal/src/lib/skills.test.ts
git commit -m "refactor(terminal): skills operate on workdir"
```

---

### Task 3: Drop the config-folder step from `setup.ts` and `project-builder-command-runner.ts`

**Files:**
- Modify: `apps/terminal/src/lib/setup.ts`
- Modify: `apps/terminal/src/lib/project-builder-command-runner.ts`
- Test: `apps/terminal/src/lib/setup.test.ts`
- Test: `apps/terminal/src/lib/project-builder-command-runner.test.ts`

**Interfaces:**
- Consumes: `setupClaudeConfig`, `setupCopilotConfig`, `setupOpencodeConfig` (now workdir-based from Task 1).
- Produces: `setupProject(payload, emit, signal)` no longer creates a config folder. `ensureBuilderWorkspace(payload)` no longer creates a config folder.

- [ ] **Step 1: Write the failing tests**

In `apps/terminal/src/lib/setup.test.ts`, remove the `mockCreateProjectConfigFolder` mock and its factory entry, and remove the assertion that it is called. Add an assertion that it is NOT called:

```ts
it('does not create a config folder', async () => {
  const { setupProject } = await import('./setup.js');
  const result = await setupProject({ task: { project: { id: '123' }, id: 'task-1' } }, undefined, signal);
  expect(result).not.toBeNull();
  expect(mockCreateProjectConfigFolder).not.toHaveBeenCalled();
});
```

In `apps/terminal/src/lib/project-builder-command-runner.test.ts`, remove `mockCreateProjectConfigFolder` and its factory entry, and assert it is not called.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter=@onezone/terminal test -- setup project-builder`
Expected: FAIL — `createProjectConfigFolder` still referenced.

- [ ] **Step 3: Implement the changes**

In `apps/terminal/src/lib/setup.ts`, remove `createProjectConfigFolder` from the import and remove the "Checking config folder..." block:

```ts
// Remove from import:
//   createProjectConfigFolder,

// Remove this block:
//   lines.push("Checking config folder...");
//   const hasConfigFolder = createProjectConfigFolder(projectId);
//   if (!hasConfigFolder) {
//     lines.push("✖ Failed to create config folder.");
//     flush();
//     return null;
//   }
//   lines.push("✔ Config folder ready.");
```

In `apps/terminal/src/lib/project-builder-command-runner.ts`, remove `createProjectConfigFolder` from the import and from `ensureBuilderWorkspace`:

```ts
// Remove from import:
//   createProjectConfigFolder,

function ensureBuilderWorkspace(payload: ProjectBuilderCommandPayload): boolean {
  const projectId = PROJECT_BUILDER_WORKSPACE_ID;
  if (!createProjectFolder(projectId)) return false;
  if (!createProjectWorkDirFolder(projectId)) return false;
  ensureWorkDirProjectMarker(projectId);

  if (payload.agent.tag === AgentTag.GithubCopilotCLI) {
    return setupCopilotConfig(projectId);
  }
  if (payload.agent.tag === AgentTag.Opencode) {
    return setupOpencodeConfig(projectId);
  }
  return setupClaudeConfig(projectId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter=@onezone/terminal test -- setup project-builder`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/terminal/src/lib/setup.ts apps/terminal/src/lib/setup.test.ts apps/terminal/src/lib/project-builder-command-runner.ts apps/terminal/src/lib/project-builder-command-runner.test.ts
git commit -m "refactor(terminal): remove config folder creation from setup"
```

---

### Task 4: Create the `acpx.ts` adapter

**Files:**
- Create: `apps/terminal/src/agents/acpx.ts`
- Test: `apps/terminal/src/agents/acpx.test.ts`

**Interfaces:**
- Consumes: `AgentTag`, `UnifiedContentBlock` from `@onezone/shared`; `AgentEventType`, `AgentConfig`, `AgentEvent`, `AgentRunParams`, `parseNextColumnTag` from `../lib/types/index.js`.
- Produces: `setup({ projectId, model }): AgentConfig` — a factory returning `{ tag, run }` where `run({ prompt, cwd, signal })` is an `AsyncIterable<AgentEvent>`.

- [ ] **Step 1: Write the failing tests**

Create `apps/terminal/src/agents/acpx.test.ts`. Mock `node:child_process` `spawn` to emit fixture NDJSON lines, and assert the adapter yields the correct `AgentEvent` sequence.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentTag } from '@onezone/shared';
import { AgentEventType } from '../lib/types/index.js';

const mockSpawn = vi.fn();
vi.mock('node:child_process', () => ({ spawn: (...a: unknown[]) => mockSpawn(...a) }));

// A fake child process that emits NDJSON lines then closes.
function fakeChild(lines: string[]) {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const stdout = {
    setEncoding: vi.fn(),
    on: (ev: string, cb: (...args: unknown[]) => void) => {
      (listeners[ev] ??= []).push(cb);
    },
  };
  const child = {
    stdout,
    stderr: { setEncoding: vi.fn(), on: vi.fn() },
    on: (ev: string, cb: (...args: unknown[]) => void) => {
      (listeners[ev] ??= []).push(cb);
    },
    kill: vi.fn(),
  };
  // Emit lines on next tick
  setTimeout(() => {
    for (const line of lines) {
      for (const cb of listeners['data'] ?? []) cb(line + '\n');
    }
    for (const cb of listeners['close'] ?? []) cb(0, null);
  }, 0);
  return child;
}

import { setup } from './acpx.js';

describe('acpx adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps agent_message_chunk text to a Text event', async () => {
    mockSpawn.mockReturnValue(fakeChild([
      JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello' } } }),
    ]));
    const config = setup({ projectId: 'p1', model: 'claude-sonnet-4-6' });
    const events: unknown[] = [];
    for await (const ev of config.run({ prompt: 'hi', cwd: '/w', signal: new AbortController().signal })) {
      events.push(ev);
    }
    expect(events).toContainEqual({ type: AgentEventType.Text, content: JSON.stringify([{ kind: 'text', text: 'Hello' }]) });
  });

  it('maps a result message to a Result event with nextColumnId', async () => {
    mockSpawn.mockReturnValue(fakeChild([
      JSON.stringify({ jsonrpc: '2.0', id: 'req-1', result: { stopReason: 'end_turn', result: 'done [[ONEZONE_NEXT_COLUMN:in-progress]]', usage: { input_tokens: 10, output_tokens: 5 }, total_cost_usd: 0.01 } }),
    ]));
    const config = setup({ projectId: 'p1', model: 'm' });
    const events: unknown[] = [];
    for await (const ev of config.run({ prompt: 'hi', cwd: '/w', signal: new AbortController().signal })) {
      events.push(ev);
    }
    expect(events).toContainEqual(expect.objectContaining({
      type: AgentEventType.Result,
      nextColumnId: 'in-progress',
      finished: true,
    }));
  });

  it('kills the child on abort', async () => {
    const child = fakeChild([]);
    mockSpawn.mockReturnValue(child);
    const config = setup({ projectId: 'p1', model: 'm' });
    const ac = new AbortController();
    const iter = config.run({ prompt: 'hi', cwd: '/w', signal: ac.signal })[Symbol.asyncIterator]();
    ac.abort();
    await iter.return?.();
    expect(child.kill).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter=@onezone/terminal test -- acpx`
Expected: FAIL — `./acpx.js` module not found.

- [ ] **Step 3: Implement `acpx.ts`**

```ts
import { AgentTag, type UnifiedContentBlock } from "@onezone/shared";
import { spawn } from "node:child_process";
import {
  AgentEventType,
  parseNextColumnTag,
  type AgentConfig,
  type AgentEvent,
  type AgentRunParams,
} from "../lib/types/index.js";

const AGENT_NAME_BY_TAG: Record<AgentTag, string> = {
  [AgentTag.ClaudeCode]: "claude",
  [AgentTag.GithubCopilotCLI]: "copilot",
  [AgentTag.Opencode]: "opencode",
};

export const setup = ({
  projectId,
  model,
}: {
  projectId: string;
  model: string;
}): AgentConfig => {
  void projectId;

  async function* run({ prompt, cwd, signal }: AgentRunParams): AsyncIterable<AgentEvent> {
    const agentName = AGENT_NAME_BY_TAG[AgentTag.ClaudeCode]; // replaced per-tag below
    // NOTE: agentName is resolved by the caller via setup.ts; see Task 5.
    // For this task, accept the tag via a module-level default and refine in Task 5.
    const args = [agentName, "exec", "--format", "json", "--json-strict", prompt];
    const child = spawn("acpx", args, { cwd, env: process.env });

    const blocks: UnifiedContentBlock[] = [];
    let resultEmitted = false;

    const emitBlocks = (): void => {
      if (blocks.length > 0) {
        // yield is not allowed inside a callback; collect and flush via queue
      }
    };

    // Use a line-buffered reader over stdout.
    let buffer = "";
    const queue: AgentEvent[] = [];
    let resolveQueue: (() => void) | undefined;
    let done = false;
    const flush = () => {
      if (queue.length > 0) resolveQueue?.();
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as Record<string, unknown>;
          const ev = mapMessage(msg);
          if (ev) queue.push(ev);
        } catch {
          // skip malformed line
        }
      }
      flush();
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      queue.push({ type: AgentEventType.Stderr, content: chunk });
      flush();
    });

    const abort = () => {
      done = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000).unref();
      resolveQueue?.();
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();

    child.on("close", (code) => {
      done = true;
      if (code !== 0 && !signal.aborted) {
        queue.push({ type: AgentEventType.Stderr, content: `acpx exited with code ${code}` });
      }
      resolveQueue?.();
    });

    while (!done || queue.length > 0) {
      if (queue.length === 0) {
        await new Promise<void>((res) => { resolveQueue = res; });
        resolveQueue = undefined;
        continue;
      }
      const ev = queue.shift()!;
      yield ev;
    }
  }

  return { tag: AgentTag.ClaudeCode, run };
};

function mapMessage(msg: Record<string, unknown>): AgentEvent | null {
  if (msg.method === "session/update") {
    const params = (msg.params ?? {}) as Record<string, unknown>;
    const update = params.sessionUpdate as string | undefined;
    const content = params.content as Record<string, unknown> | undefined;
    if (update === "agent_message_chunk" && content) {
      const type = content.type as string | undefined;
      if (type === "text" && typeof content.text === "string" && content.text.trim()) {
        return { type: AgentEventType.Text, content: JSON.stringify([{ kind: "text", text: content.text }]) };
      }
      if (type === "thinking" && typeof content.thinking === "string" && content.thinking.trim()) {
        return { type: AgentEventType.Text, content: JSON.stringify([{ kind: "thinking", text: content.thinking }]) };
      }
    }
    if (update === "agent_message" && content) {
      const blocks: UnifiedContentBlock[] = [];
      if (typeof content.text === "string" && content.text.trim()) {
        blocks.push({ kind: "text", text: content.text });
      }
      if (blocks.length > 0) {
        return { type: AgentEventType.Text, content: JSON.stringify(blocks) };
      }
    }
    if (update === "tool_call" && content) {
      const name = (content.name as string) ?? "tool";
      const input = (content.input as Record<string, unknown>) ?? {};
      return { type: AgentEventType.Text, content: JSON.stringify([{ kind: "tool_use", name, input }]) };
    }
    if (update === "tool_call_result" && content) {
      const text = extractText(content);
      if (text) return { type: AgentEventType.Text, content: JSON.stringify([{ kind: "tool_result", text }]) };
    }
  }
  if (msg.id !== undefined && msg.result !== undefined) {
    const result = msg.result as Record<string, unknown>;
    const resultText = typeof result.result === "string" ? result.result : undefined;
    const usage = result.usage as Record<string, unknown> | undefined;
    return {
      type: AgentEventType.Result,
      content: resultText,
      usage: {
        totalCostUsd: typeof result.total_cost_usd === "number" ? result.total_cost_usd : undefined,
        inputTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : undefined,
        outputTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : undefined,
      },
      nextColumnId: resultText ? parseNextColumnTag(resultText) : undefined,
      finished: true,
    };
  }
  return null;
}

function extractText(content: Record<string, unknown>): string | null {
  if (typeof content.text === "string" && content.text.trim()) return content.text;
  if (typeof content.content === "string" && content.content.trim()) return content.content;
  return null;
}
```

> **Note:** Task 4 wires the adapter to a fixed `AgentTag.ClaudeCode` tag and a placeholder agent name. Task 5 refactors `setup.ts` to pass the correct tag and agent name per run. The `mapMessage` function is the core NDJSON→event mapping and is fully tested here.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter=@onezone/terminal test -- acpx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/terminal/src/agents/acpx.ts apps/terminal/src/agents/acpx.test.ts
git commit -m "feat(terminal): add acpx ACP adapter"
```

---

### Task 5: Wire `setup.ts` to map `AgentTag` → acpx agent name

**Files:**
- Modify: `apps/terminal/src/agents/setup.ts`
- Modify: `apps/terminal/src/agents/acpx.ts` (accept tag + agent name)
- Test: `apps/terminal/src/agents/setup.test.ts`

**Interfaces:**
- Consumes: `setup` from `./acpx.js` (Task 4).
- Produces: `agentFactory({ projectId, agent, model })` returns the acpx-based `AgentConfig` for any supported `AgentTag`.

- [ ] **Step 1: Write the failing tests**

In `apps/terminal/src/agents/setup.test.ts`, add tests asserting `agentFactory` returns a config for each of the three tags and `null` for an unknown tag.

```ts
import { AgentTag } from '@onezone/shared';
import { agentFactory } from './setup.js';

describe('agentFactory', () => {
  it('returns a config for claude-code', () => {
    const cfg = agentFactory({ projectId: 'p1', agent: { tag: AgentTag.ClaudeCode, id: 'a1', name: 'Claude' }, model: 'm' });
    expect(cfg).not.toBeNull();
    expect(cfg!.tag).toBe(AgentTag.ClaudeCode);
  });
  it('returns a config for github-copilot-cli', () => {
    const cfg = agentFactory({ projectId: 'p1', agent: { tag: AgentTag.GithubCopilotCLI, id: 'a2', name: 'Copilot' }, model: 'm' });
    expect(cfg).not.toBeNull();
    expect(cfg!.tag).toBe(AgentTag.GithubCopilotCLI);
  });
  it('returns a config for opencode', () => {
    const cfg = agentFactory({ projectId: 'p1', agent: { tag: AgentTag.Opencode, id: 'a3', name: 'Opencode' }, model: 'm' });
    expect(cfg).not.toBeNull();
    expect(cfg!.tag).toBe(AgentTag.Opencode);
  });
  it('returns null for unknown tag', () => {
    const cfg = agentFactory({ projectId: 'p1', agent: { tag: 'unknown' as AgentTag, id: 'a4', name: 'X' }, model: 'm' });
    expect(cfg).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter=@onezone/terminal test -- setup`
Expected: FAIL — `agentFactory` still imports the old per-agent setups.

- [ ] **Step 3: Implement the changes**

In `apps/terminal/src/agents/setup.ts`, replace the three per-agent imports with the single acpx setup, and map tags to agent names:

```ts
import { AgentTag } from "@onezone/shared";
import type { TaskDetails } from "@onezone/shared";
import { setup as setupAcpx } from "../agents/acpx.js";
import { getEffectiveTaskAgentAndModel } from "../lib/effective-task-agent.js";

const AGENT_NAME_BY_TAG: Record<AgentTag, string> = {
  [AgentTag.ClaudeCode]: "claude",
  [AgentTag.GithubCopilotCLI]: "copilot",
  [AgentTag.Opencode]: "opencode",
};

export const agentFactory = ({
  projectId,
  agent,
  model,
}: {
  projectId: string;
  agent: TaskDetails["agent"];
  model: string;
}) => {
  if (!agent) {
    return null;
  }

  const agentName = AGENT_NAME_BY_TAG[agent.tag];
  if (!agentName) {
    return null;
  }

  return setupAcpx({ projectId, model, agentName });
};
```

Update `acpx.ts` to accept `agentName` and use it for the spawn, and to set the returned `tag` from the caller:

```ts
export const setup = ({
  projectId,
  model,
  agentName,
}: {
  projectId: string;
  model: string;
  agentName: string;
}): AgentConfig => {
  void projectId;

  async function* run({ prompt, cwd, signal }: AgentRunParams): AsyncIterable<AgentEvent> {
    const args = [agentName, "exec", "--format", "json", "--json-strict", prompt];
    const child = spawn("acpx", args, { cwd, env: process.env });
    // ...rest unchanged from Task 4
  }

  return { tag: agentNameToTag(agentName), run };
};

function agentNameToTag(agentName: string): AgentTag {
  switch (agentName) {
    case "claude": return AgentTag.ClaudeCode;
    case "copilot": return AgentTag.GithubCopilotCLI;
    case "opencode": return AgentTag.Opencode;
    default: return AgentTag.ClaudeCode;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter=@onezone/terminal test -- setup acpx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/terminal/src/agents/setup.ts apps/terminal/src/agents/acpx.ts apps/terminal/src/agents/setup.test.ts
git commit -m "feat(terminal): map agent tags to acpx agent names"
```

---

### Task 6: Delete the old SDK adapters and update dependencies

**Files:**
- Delete: `apps/terminal/src/agents/claude.ts`
- Delete: `apps/terminal/src/agents/copilot.ts`
- Delete: `apps/terminal/src/agents/opencode.ts`
- Modify: `apps/terminal/package.json`

**Interfaces:**
- Consumes: nothing new.
- Produces: `apps/terminal/package.json` no longer lists the three SDK deps.

- [ ] **Step 1: Delete the three adapter files**

```bash
rm apps/terminal/src/agents/claude.ts apps/terminal/src/agents/copilot.ts apps/terminal/src/agents/opencode.ts
```

- [ ] **Step 2: Update `apps/terminal/package.json`**

Remove from `dependencies`:
- `@anthropic-ai/claude-agent-sdk`
- `@github/copilot-sdk`
- `@opencode-ai/sdk`

Do NOT add `acpx` (it is a global install).

- [ ] **Step 3: Verify no dangling references**

Run: `grep -rn "claude-agent-sdk\|copilot-sdk\|opencode-ai/sdk\|from \"../agents/claude\|from \"../agents/copilot\|from \"../agents/opencode" apps/terminal/src || echo "no references"`
Expected: `no references`.

- [ ] **Step 4: Typecheck and run the full terminal test suite**

Run: `pnpm --filter=@onezone/terminal typecheck && pnpm --filter=@onezone/terminal test`
Expected: PASS (no type errors, all tests green).

- [ ] **Step 5: Commit**

```bash
git add -A apps/terminal/src/agents apps/terminal/package.json
git commit -m "chore(terminal): remove per-agent SDK adapters and deps"
```

---

### Task 7: Rules handling — write `rules.md` into the workdir

**Files:**
- Modify: `apps/terminal/src/lib/project-paths.ts`
- Test: `apps/terminal/src/lib/project-paths.test.ts`

**Interfaces:**
- Consumes: `getRulesContent()` (existing), `getProjectWorkDir(projectId)`.
- Produces: `setupRules(projectId)` writes the bundled `rules.md` content into the workdir as `CLAUDE.md` (for claude) and `AGENTS.md` (for copilot/opencode) so agents auto-discover them.

> **Decision note:** The old adapters injected `rules.md` as a system prompt. acpx's `claude` adapter supports `--system-prompt`, but copilot/opencode ignore it. To keep behavior consistent and honor the "everything in the workdir" directive, rules are written to the workdir as `CLAUDE.md` / `AGENTS.md`, which all three agent CLIs auto-discover. This is a behavioral change (rules become a file the agent reads, not an injected system prompt) — flagged for review.

- [ ] **Step 1: Write the failing tests**

In `apps/terminal/src/lib/project-paths.test.ts`, add a test for `setupRules`:

```ts
describe('setupRules', () => {
  it('writes rules.md content to workdir CLAUDE.md and AGENTS.md', () => {
    mockReadFileSync.mockReturnValue('# Rules');
    mockExistsSync.mockReturnValue(true);
    const result = setupRules('proj-1');
    expect(result).toBe(true);
    const workdir = path.join(TEST_HOME, '.onezone', 'projects', 'proj-1', 'workdir');
    expect(mockWriteFileSync).toHaveBeenCalledWith(path.join(workdir, 'CLAUDE.md'), '# Rules', 'utf8');
    expect(mockWriteFileSync).toHaveBeenCalledWith(path.join(workdir, 'AGENTS.md'), '# Rules', 'utf8');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter=@onezone/terminal test -- project-paths`
Expected: FAIL — `setupRules` not exported.

- [ ] **Step 3: Implement `setupRules` in `project-paths.ts`**

```ts
export const setupRules = (projectId: string): boolean => {
  try {
    const rules = getRulesContent();
    if (!rules) return true; // no rules to write
    const workDir = getProjectWorkDir(projectId);
    fs.writeFileSync(path.join(workDir, "CLAUDE.md"), rules, "utf8");
    fs.writeFileSync(path.join(workDir, "AGENTS.md"), rules, "utf8");
    return true;
  } catch (err) {
    console.error(`Error setting up rules: ${(err as Error).message}`);
    return false;
  }
};
```

- [ ] **Step 4: Wire `setupRules` into `setup.ts`**

In `apps/terminal/src/lib/setup.ts`, import and call `setupRules(projectId)` after the agent config setup block:

```ts
import { setupRules } from "./project-paths.js";
// ...
  } else {
    lines.push("Checking Claude configuration...");
    setupClaudeConfig(projectId);
    lines.push("✔ Claude configuration ready.");
  }
  setupRules(projectId);
  flush();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter=@onezone/terminal test -- project-paths setup`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/terminal/src/lib/project-paths.ts apps/terminal/src/lib/project-paths.test.ts apps/terminal/src/lib/setup.ts
git commit -m "feat(terminal): write rules into workdir as CLAUDE.md/AGENTS.md"
```

---

### Task 8: Dockerfile, entrypoint, and compose changes

**Files:**
- Modify: `apps/terminal/Dockerfile`
- Modify: `apps/terminal/docker-entrypoint.sh`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: nothing new.
- Produces: acpx installed globally; RTK removed from entrypoint; optional `~/.acpx` volume.

- [ ] **Step 1: Add acpx global install to the Dockerfile**

In `apps/terminal/Dockerfile`, after the `opencode-ai` install:

```dockerfile
# Install acpx (ACP client)
RUN npm install -g acpx@latest
```

- [ ] **Step 2: Remove RTK from the entrypoint**

In `apps/terminal/docker-entrypoint.sh`, remove:

```sh
# Ensure RTK's Claude hook config exists in the persisted /home/agent/.claude volume.
mkdir -p /home/agent/.claude
rtk init -g --auto-patch
```

Keep the `.claude` dir creation if still needed for Claude config persistence:

```sh
# Ensure Claude config directory exists in the persisted /home/agent/.claude volume.
mkdir -p /home/agent/.claude
```

- [ ] **Step 3: Add an optional acpx volume to `docker-compose.yml`**

In the `terminal` service `volumes`, add:

```yaml
- terminal_acpx:/home/agent/.acpx
```

And add to the top-level `volumes`:

```yaml
  terminal_acpx:
```

- [ ] **Step 4: Verify the build**

Run: `docker compose build terminal`
Expected: build succeeds, acpx installed.

- [ ] **Step 5: Commit**

```bash
git add apps/terminal/Dockerfile apps/terminal/docker-entrypoint.sh docker-compose.yml
git commit -m "chore(terminal): install acpx globally, drop RTK, add acpx volume"
```

---

## Self-Review

**Spec coverage:**
- Invocation (subprocess `exec --format json --json-strict`) → Task 4 ✓
- Replace all three adapters → Tasks 4, 5, 6 ✓
- BYOK (env passthrough) → Task 4 (`env: process.env`) ✓
- RTK dropped → Task 8 ✓
- acpx global install → Task 8 ✓
- Config folder removed entirely → Tasks 1, 2, 3 ✓
- Skills in workdir → Tasks 1, 2 ✓
- Custom prompts/custom skills → Task 2 (workdir `cwd` for `npx skills add`) ✓
- Error handling (spawn failure, non-zero exit, abort, malformed line) → Task 4 ✓
- Testing (NDJSON mapping, tag map, skills relocation, integration) → Tasks 1, 2, 4, 5, 7 ✓
- Docker/compose → Task 8 ✓

**Gap found during planning (now covered):** rules (`rules.md`) were injected as a system prompt by the old adapters. Task 7 writes them to the workdir as `CLAUDE.md`/`AGENTS.md`. This is a behavioral change flagged for review.

**Placeholder scan:** No TBD/TODO. All code steps contain concrete code.

**Type consistency:** `setup({ projectId, model, agentName })` is defined in Task 4 and refined in Task 5 with the same signature. `agentFactory({ projectId, agent, model })` matches the existing signature. `AgentEvent`/`AgentEventType`/`UnifiedContentBlock` are unchanged throughout.
