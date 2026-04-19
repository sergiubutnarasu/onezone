import { Command, Flags } from "@oclif/core";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { createAgentSocket } from "../lib/socket-client.js";
import { runProcess } from "../lib/process-runner.js";

interface ChatMessage {
  role: "user" | "agent" | "system";
  content: string;
}

// Strip ANSI escape sequences and simulate \r overwrite so chat output is readable
function stripAnsi(str: string): string {
  // Split on \r to simulate terminal overwrite — take the last segment
  // (spinner lines like "⠙ \r⠹ \r⠸ \r" become empty and get filtered out)
  const segments = str.split('\r');
  const visible = segments[segments.length - 1] ?? str;
  return visible.replace(/\x1B\[[0-9;?]*[A-Za-z]|\x1B[A-Za-z]/g, '').trim();
}

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

      socket.on("chat:message", (message: ChatMessage) => {
        // Only react to user messages
        if (message.role !== "user") return;

        const content = message.content.trim();
        if (!content) return;

        this.log(`[${agentName}] Spawning: ${content}`);

        const jobId = randomUUID();

        socket.emit("agent:command:start", {
          roomId,
          agentId,
          agentName,
          jobId,
          command: content,
        });

        // Run with shell=true so quoted args and shell syntax work correctly
        const stderrBuffer: string[] = [];
        const proc = runProcess(
          content,
          [],
          (stream, line) => {
            const clean = stripAnsi(line);
            if (!clean) return; // skip lines that were pure escape sequences

            if (stream === 'stderr') {
              // Buffer stderr — only emit if the process fails
              stderrBuffer.push(clean);
              return;
            }
            socket.emit("output:line", {
              roomId,
              agentId,
              agentName,
              jobId,
              command: content,
              stream,
              content: clean,
            });
          },
          (exitCode) => {
            activeProcesses.delete(jobId);

            // Flush stderr only on failure
            if (exitCode !== 0) {
              for (const line of stderrBuffer) {
                socket.emit("output:line", {
                  roomId,
                  agentId,
                  agentName,
                  jobId,
                  command: content,
                  stream: 'stderr',
                  content: line,
                });
              }
            }

            socket.emit("agent:command:exit", {
              roomId,
              agentId,
              jobId,
              command: content,
              exitCode,
            });
            const badge = exitCode === 0 ? '✔ done' : `✖ error (${exitCode})`;
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
        reject(new Error(`Disconnected: ${reason}`));
      });
    });
  }
}
