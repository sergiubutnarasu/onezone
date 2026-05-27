import { Command, Flags } from "@oclif/core";
import type { Task } from "@onezone/shared";
import { authenticatedFetch } from "../../lib/config.js";

export default class TaskCreate extends Command {
  static description = "Create a new task in a project";

  static examples = [
    '<%= config.bin %> task create --project <uuid> --name "My task" --terminal <terminalUuid>',
    '<%= config.bin %> task create --project <uuid> --name "My task" --description "Details" --terminal <terminalUuid>',
  ];

  static flags = {
    project: Flags.string({
      description: "Project ID (UUID)",
      required: true,
    }),
    name: Flags.string({
      description: "Task name",
      required: true,
    }),
    description: Flags.string({
      description: "Task description",
      required: false,
    }),
    terminal: Flags.string({
      description: "Terminal ID (UUID) to assign to this task",
      required: true,
    }),
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TaskCreate);
    const baseUrl = flags.server;

    const body: { name: string; description?: string; terminalId: string } = {
      name: flags.name,
      terminalId: flags.terminal,
    };
    if (flags.description) body.description = flags.description;

    let task: Task;
    try {
      const response = await authenticatedFetch(
        `${baseUrl}/projects/${flags.project}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        baseUrl,
      );

      if (!response.ok) {
        this.error(
          `Server returned ${response.status}: ${response.statusText}`,
          { exit: 1 },
        );
      }
      task = (await response.json()) as Task;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    this.log(`Created task: ${task.id}`);
  }
}
