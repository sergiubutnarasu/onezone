import { Args, Command, Flags } from "@oclif/core";
import { Task } from "@onezone/shared";

export default class TaskViewCommand extends Command {
  static description = "View details of a task";

  static examples = [
    "<%= config.bin %> task view <task-id>",
    "<%= config.bin %> task view <task-id> --server http://localhost:5026",
  ];

  static args = {
    id: Args.string({ description: "Task ID (UUID)", required: true }),
  };

  static flags = {
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskViewCommand);

    let task: Task;
    try {
      const response = await fetch(`${flags.server}/tasks/${args.id}`);
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

    this.log(`ID:          ${task.id}`);
    this.log(`Name:        ${task.name}`);
    this.log(`Description: ${task.description ?? "-"}`);
    this.log(`Status:      ${task.status}`);
    this.log(`Agent:       ${task.agent?.name ?? "-"}`);
  }
}
