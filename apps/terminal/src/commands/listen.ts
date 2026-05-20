// apps/terminal/src/commands/listen.ts

import { Command, Flags } from "@oclif/core";
import type { TaskDetails } from "@onezone/shared";
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
    "Starts a terminal instance that listens for task assignments and executes commands accordingly. " +
    "The terminal will automatically execute commands for tasks assigned to it, based on the task's status. " +
    "Use this command to keep a terminal instance running in the background, ready to handle incoming tasks.";

  static examples = [
    "<%= config.bin %> listen",
    "<%= config.bin %> listen --name my-terminal",
  ];

  static flags = {
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

    const lobbyDeps = {
      serverUrl: flags.server,
      terminalId,
      terminalName,
      activeTaskIds: this.activeTaskIds,
      onTaskAssigned: (task: TaskDetails) =>
        connectToTask({
          serverUrl: flags.server,
          task,
          terminalId,
          terminalName,
          activeTaskIds: this.activeTaskIds,
          log: (msg, ...args) => this.log(msg, ...args),
        }),
      log: (msg: string, ...args: unknown[]) => this.log(msg, ...args),
    };

    // Retry loop: if the server disconnects the lobby (e.g. due to an expired
    // token), wait briefly (so any in-flight token refresh can complete) then
    // reconnect with the updated token.
    while (true) {
      try {
        await connectToLobby(lobbyDeps);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.log(`[${terminalName}] ${message}, reconnecting in 3s...`);
        // When the server disconnects the lobby, all task sockets to that
        // server are also dead. Clear tracking so the server can reassign
        // every task cleanly on reconnect.
        this.activeTaskIds.clear();
        await new Promise<void>((resolve) => setTimeout(resolve, 3000));
      }
    }
  }
}
