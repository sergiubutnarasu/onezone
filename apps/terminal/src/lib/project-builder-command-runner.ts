import { AgentTag, type ProjectBuilderCommandPayload } from "@onezone/shared";
import { agentFactory } from "../agents/setup.js";
import {
  createProjectConfigFolder,
  createProjectFolder,
  createProjectWorkDirFolder,
  ensureWorkDirProjectMarker,
  getProjectWorkDir,
  setupClaudeConfig,
  setupCopilotConfig,
  setupOpencodeConfig,
} from "./project-paths.js";
import { AgentEventType } from "./types/index.js";

const PROJECT_BUILDER_WORKSPACE_ID = "__onezone_project_builder";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function buildPrompt(payload: ProjectBuilderCommandPayload, serverUrl: string): string {
  const optionalFlags = [
    payload.projectDescription
      ? `--description ${shellQuote(payload.projectDescription)}`
      : null,
    payload.repository ? `--repository ${shellQuote(payload.repository)}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const optionalSegment = optionalFlags ? ` ${optionalFlags}` : "";

  return [
    "Use the onezone-project-builder skill to create a new Onezone project and generate its kanban board.",
    "Search for relevant skills with `npx skills find [query]`. If useful suggestions exist, add one `--skill '<source> --skill <name>'` argument per suggestion before `--server` in the terminal command. If no useful suggestions exist, omit `--skill`.",
    "Create practical board columns from the user's request, write them to a JSON config file, then run this terminal command:",
    "```sh",
    `onezone-terminal project new --project ${shellQuote(payload.projectId)} --name ${shellQuote(payload.projectName)}${optionalSegment} --agent ${shellQuote(payload.agent.id)} --model ${shellQuote(payload.model)} --config <columns-json-file> --server ${shellQuote(serverUrl)}`,
    "```",
    "User request:",
    payload.boardPrompt,
  ].join("\n\n");
}

function ensureBuilderWorkspace(payload: ProjectBuilderCommandPayload): boolean {
  const projectId = PROJECT_BUILDER_WORKSPACE_ID;
  if (!createProjectFolder(projectId)) return false;
  if (!createProjectConfigFolder(projectId)) return false;
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

export async function runProjectBuilderCommand(
  payload: ProjectBuilderCommandPayload,
  deps: {
    serverUrl: string;
    terminalId: string;
    terminalName: string;
    signal?: AbortSignal;
    log: (message: string, ...args: unknown[]) => void;
  },
): Promise<void> {
  if (payload.terminalId !== deps.terminalId) return;

  deps.log(
    `[${deps.terminalName}] Running project builder command ${payload.commandId}`,
  );

  if (!ensureBuilderWorkspace(payload)) {
    throw new Error("Failed to prepare project builder workspace");
  }

  const terminalAgent = agentFactory({
    projectId: PROJECT_BUILDER_WORKSPACE_ID,
    agent: payload.agent,
    model: payload.model,
  });
  if (!terminalAgent) {
    throw new Error(`No terminal agent configured for ${payload.agent.name}`);
  }

  const abortController = new AbortController();
  const abort = () => abortController.abort();
  deps.signal?.addEventListener("abort", abort, { once: true });
  const prompt = buildPrompt(payload, deps.serverUrl);
  const cwd = getProjectWorkDir(PROJECT_BUILDER_WORKSPACE_ID);

  try {
    for await (const event of terminalAgent.run({
      prompt,
      cwd,
      signal: abortController.signal,
    })) {
      if (event.type === AgentEventType.Text || event.type === AgentEventType.Stderr) {
        deps.log(`[${deps.terminalName}] ${event.content}`);
      }
    }
  } finally {
    deps.signal?.removeEventListener("abort", abort);
  }

  if (abortController.signal.aborted) {
    deps.log(
      `[${deps.terminalName}] Project builder command ${payload.commandId} stopped`,
    );
    return;
  }

  deps.log(
    `[${deps.terminalName}] Project builder command ${payload.commandId} finished`,
  );
}
