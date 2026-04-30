// apps/terminal/src/commands/listen.ts

import { Command, Flags } from "@oclif/core";
import { hostname } from "node:os";
import { connectToLobby } from "../lib/lobby-connection.js";
import { registerCleanupHandlers } from "../lib/process-runner.js";
import { connectToTask } from "../lib/task-connection.js";
import { registerTerminal } from "../lib/terminal-registration.js";

export default class Listen extends Command {
  private readonly activeTaskIds = new Set<string>();

  override log(message: string, ...args: unknown[]): void {
    const ts = new Date().toLocaleString();
    super.log(`[${ts}] ${message}`, ...args);
  }

  static description =
    "Connect to a task room (or wait for one to be assigned) and stay open, spawning commands as users send messages in the chat";

  static examples = [
    "<%= config.bin %> listen",
    "<%= config.bin %> listen --task <taskId>",
    "<%= config.bin %> listen --task <taskId1> --task <taskId2>",
    "<%= config.bin %> listen --task <taskId> --name my-terminal",
  ];

  static flags = {
    task: Flags.string({
      description:
        "Task ID to connect to (can be repeated). If omitted, waits for the server to assign one.",
      required: false,
      multiple: true,
    }),
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
    name: Flags.string({
      description:
        "Terminal name — must be unique across all running terminals",
      default: hostname(),
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Listen);

    const terminalName = flags.name;
    const taskIds = flags.task;

    let terminalId: string;
    try {
      terminalId = await registerTerminal({
        serverUrl: flags.server,
        name: terminalName,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    this.log(`[${terminalName}] Terminal ID: ${terminalId}`);

    registerCleanupHandlers();

    const connections: Promise<void>[] = [
      connectToLobby({
        serverUrl: flags.server,
        terminalId,
        terminalName,
        activeTaskIds: this.activeTaskIds,
        onTaskAssigned: (taskId) =>
          connectToTask({
            serverUrl: flags.server,
            taskId,
            terminalId,
            terminalName,
            activeTaskIds: this.activeTaskIds,
            log: (msg, ...args) => this.log(msg, ...args),
          }),
        log: (msg, ...args) => this.log(msg, ...args),
      }),
    ];

    if (taskIds?.length) {
      for (const taskId of taskIds) {
        this.activeTaskIds.add(taskId);
      }
      connections.push(
        ...taskIds.map((taskId) =>
          connectToTask({
            serverUrl: flags.server,
            taskId,
            terminalId,
            terminalName,
            activeTaskIds: this.activeTaskIds,
            log: (msg, ...args) => this.log(msg, ...args),
          }),
        ),
      );
    }

    await Promise.all(connections);
  }
}
