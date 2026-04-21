import { Command, Flags } from "@oclif/core";
import { ChatMessage, EventCommands, MessageRole, MessageStream } from "@onezone/shared";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { registerCleanupHandlers, runProcess } from "../lib/process-runner.js";
import { createAgentSocket } from "../lib/socket-client.js";
import { stripAnsi } from "../lib/helper.js";

const HEARTBEAT_INTERVAL_MS = 30_000; // Must be less than AgentsService.STALE_THRESHOLD_MS in server to avoid false positives

export default class Listen extends Command {
  static description =
    "Connect to a task room and stay open, spawning commands as users send messages in the chat";

  static examples = [
    "<%= config.bin %> listen --task <taskId>",
    "<%= config.bin %> listen --task <taskId1> --task <taskId2>",
    "<%= config.bin %> listen --task <taskId> --name my-agent",
  ];

  static flags = {
    task: Flags.string({
      description: "Task ID to connect to (can be repeated for multiple tasks)",
      required: true,
      multiple: true,
    }),
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
    name: Flags.string({
      description: "Agent name — must be unique across all running agents",
      default: hostname(),
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Listen);

    const agentName = flags.name;
    const taskIds = flags.task;

    // Register with the server by name. The server enforces uniqueness and
    // rejects the request if an agent with this name is already connected.
    const agentId = await this.registerAgent(flags.server, agentName);
    this.log(`[${agentName}] Agent ID: ${agentId}`);

    registerCleanupHandlers();

    await Promise.all(taskIds.map((taskId) => this.connectToTask(flags.server, taskId, agentId, agentName)));
  }

  private connectToTask(serverUrl: string, taskId: string, agentId: string, agentName: string): Promise<void> {
    const roomId = `task:${taskId}`;

    const socket = createAgentSocket({
      serverUrl,
      taskId,
      agentId,
      agentName,
    });

    return new Promise<void>((_, reject) => {
      const activeProcesses = new Map<string, ReturnType<typeof runProcess>>();
      let heartbeatTimer: NodeJS.Timeout | undefined;

      socket.on("connect", () => {
        this.log(
          `[${agentName}] Connected to ${serverUrl} | room: ${roomId} | Listening for commands...`,
        );

        heartbeatTimer = setInterval(() => {
          socket.emit(EventCommands.AgentHeartbeat);
        }, HEARTBEAT_INTERVAL_MS);
      });

      socket.on(EventCommands.ChatMessage, (message: ChatMessage) => {
        // Only react to user messages
        if (message.role !== MessageRole.User) {
          return;
        }

        const content = message.content.trim();
        if (!content) {
          return;
        }

        this.log(`[${agentName}] [${roomId}] Spawning: ${content}`);

        const jobId = randomUUID();
        const basePayload = { roomId, agentId, agentName, jobId, command: content };

        socket.emit(EventCommands.AgentCommandStart, basePayload);

        // Run with shell=true so quoted args and shell syntax work correctly
        const stderrBuffer: string[] = [];

        const proc = runProcess(
          content,
          [],
          (stream, line) => {
            const clean = stripAnsi(line);
            if (!clean) return; // skip lines that were pure escape sequences

            if (stream === MessageStream.Stderr) {
              // Buffer stderr — only emit if the process fails
              stderrBuffer.push(clean);
              return;
            }

            socket.emit(EventCommands.OutputLine, { ...basePayload, stream, content: clean });
          },
          (exitCode) => {
            activeProcesses.delete(jobId);

            // Flush stderr only on failure
            if (exitCode !== 0) {
              for (const line of stderrBuffer) {
                socket.emit(EventCommands.OutputLine, {
                  ...basePayload,
                  stream: MessageStream.Stderr,
                  content: line,
                });
              }
            }

            socket.emit(EventCommands.AgentCommandExit, { ...basePayload, exitCode });
            const badge = exitCode === 0 ? "✔ done" : `✖ error (${exitCode})`;
            this.log(`[${agentName}] [${roomId}] ${badge}: "${content}"`);
          },
          true, // shell
        );
        activeProcesses.set(jobId, proc);
      });

      socket.on("connect_error", (err) => {
        clearInterval(heartbeatTimer);
        reject(new Error(`[${roomId}] Connection failed: ${err.message}`));
      });

      socket.on("disconnect", (reason) => {
        clearInterval(heartbeatTimer);
        // "io server disconnect" is an intentional kick — treat as fatal.
        // All other reasons (ping timeout, transport close, etc.) are transient;
        // socket.io will reconnect automatically so we just log and wait.
        if (reason === "io server disconnect") {
          reject(new Error(`[${roomId}] Disconnected: ${reason}`));
        } else {
          this.log(`[${agentName}] [${roomId}] Disconnected (${reason}), reconnecting...`);
        }
      });
    });
  }

  private async registerAgent(serverUrl: string, name: string): Promise<string> {
    const url = `${serverUrl}/agents/register`;
    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, hostname: hostname() }),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(`Could not reach server at ${serverUrl}: ${message}`, { exit: 1 });
    }

    if (response.status === 409) {
      const body = await response.json().catch(() => ({})) as { message?: string };
      this.error(body.message ?? `Agent "${name}" is already connected.`, { exit: 1 });
    }

    if (!response.ok) {
      this.error(`Server registration failed (HTTP ${response.status})`, { exit: 1 });
    }

    const agent = await response.json() as { id: string };
    return agent.id;
  }
}
