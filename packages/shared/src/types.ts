export enum EventCommands {
  ChatMessage = "chat:message",
  OutputLine = "output:line",
  AgentConnected = "agent:connected",
  AgentDisconnected = "agent:disconnected",
  AgentCommandStart = "agent:command:start",
  AgentCommandExit = "agent:command:exit",
}

export enum MessageRole {
  User = "user",
  Agent = "agent",
  System = "system",
}

export enum MessageStream {
  Stdout = "stdout",
  Stderr = "stderr",
}

export enum MessageType {
  CommandStart = "COMMAND_START",
  CommandExit = "COMMAND_EXIT",
}
