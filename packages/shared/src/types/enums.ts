export enum EventCommands {
  ChatMessage = "chat:message",
  OutputLine = "output:line",
  TerminalConnected = "terminal:connected",
  TerminalDisconnected = "terminal:disconnected",
  TerminalCommandStart = "terminal:command:start",
  TerminalCommandExit = "terminal:command:exit",
  TerminalCommandRun = "terminal:command:run",
  TerminalCommandStop = "terminal:command:stop",
  TerminalCommandPing = "terminal:command:ping",
  TerminalHeartbeat = "terminal:heartbeat",
  AssignTask = "terminal:assign-task",
  TaskDeleted = "task:deleted",
  TaskColumnUpdated = "task:column-updated",
  NotificationCreated = "notification:created",
  ProjectCostUpdated = "project:cost-updated",
}

export enum MessageRole {
  User = "user",
  Terminal = "terminal",
  System = "system",
}

export enum MessageStream {
  Stdout = "stdout",
  Stderr = "stderr",
}

export enum MessageType {
  Chat = "CHAT",
  CommandStart = "COMMAND_START",
  CommandExit = "COMMAND_EXIT",
}

export enum AgentTag {
  ClaudeCode = "claude-code",
  GithubCopilotCLI = "github-copilot-cli",
}
