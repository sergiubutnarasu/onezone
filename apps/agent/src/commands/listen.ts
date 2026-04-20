import { Command, Flags } from "@oclif/core";
import { ChatMessage, EventCommands, MessageRole, MessageStream } from "@onezone/shared";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { registerCleanupHandlers, runProcess } from "../lib/process-runner.js";
import { createAgentSocket } from "../lib/socket-client.js";
import { stripAnsi } from "../lib/helper.js";

export default class Listen extends Command {
  static description =
    "Connect to a task room and stay open, spawning commands as users send messages in the chat";

  static examples = [
    "<%= config.bin %> listen --task <taskId>",
    "<%= config.bin %> listen --task <taskId> --name my-agent",
  ];

  static flags = {
    task: Flags.string({
      description: "Task ID to connect to",
      required: true,
    }),
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
    name: Flags.string({
      description: "Agent name (defaults to hostname)",
      default: hostname(),
    }),
    "agent-id": Flags.string({
      description: "Agent ID (defaults to a random UUID)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Listen);

    registerCleanupHandlers();

    const agentId = flags["agent-id"] || randomUUID();
    const agentName = flags.name;
    const taskId = flags.task;
    const roomId = `task:${taskId}`;

    const socket = createAgentSocket({
      serverUrl: flags.server,
      taskId,
      agentId,
      agentName,
    });

    await new Promise<void>((_, reject) => {
      const activeProcesses = new Map<string, ReturnType<typeof runProcess>>();

      socket.on("connect", () => {
        this.log(
          `[${agentName}] Connected to ${flags.server} | room: ${roomId} | Listening for commands...`,
        );
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

        this.log(`[${agentName}] Spawning: ${content}`);

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
            this.log(`[${agentName}] ${badge}: "${content}"`);
          },
          true, // shell
        );
        activeProcesses.set(jobId, proc);
        // No disconnect — commands run in parallel and the agent stays open
      });

      socket.on("connect_error", (err) => {
        reject(new Error(`Connection failed: ${err.message}`));
      });

      socket.on("disconnect", (reason) => {
        // "io server disconnect" is an intentional kick — treat as fatal.
        // All other reasons (ping timeout, transport close, etc.) are transient;
        // socket.io will reconnect automatically so we just log and wait.
        if (reason === "io server disconnect") {
          reject(new Error(`Disconnected: ${reason}`));
        } else {
          this.log(`[${agentName}] Disconnected (${reason}), reconnecting...`);
        }
      });
    });
  }
}
