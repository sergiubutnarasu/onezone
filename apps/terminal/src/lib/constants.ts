export const ONEZONE_BASE_LOCATION = ".onezone";
export const ONEZONE_PROJECTS_LOCATION = `${ONEZONE_BASE_LOCATION}/projects`;

export const IO_SERVER_DISCONNECT = "io server disconnect" as const;

export const COMMAND_EXIT_ACK_TIMEOUT_MS = 5_000;
export const COMMAND_EXIT_WARN_ATTEMPTS = 3;

export const TERMINATION_GRACE_MS = 2_000;

export const SERVICE_NAME = "onezone";

export const AGENT_TAG_MAPPINGS: Record<string, string> = {
  "claude-code": "claude-code",
  "github-copilot-cli": "github-copilot",
  "opencode": "opencode",
};
