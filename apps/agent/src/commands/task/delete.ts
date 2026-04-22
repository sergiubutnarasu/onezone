import { Args, Command, Flags } from "@oclif/core";

export default class TaskDeleteCommand extends Command {
  static description = "Delete a task";

  static examples = [
    "<%= config.bin %> task delete <task-id>",
    "<%= config.bin %> task delete <task-id> --server http://localhost:5026",
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
    const { args, flags } = await this.parse(TaskDeleteCommand);

    try {
      const response = await fetch(`${flags.server}/tasks/${args.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        this.error(
          `Server returned ${response.status}: ${response.statusText}`,
          { exit: 1 },
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    this.log(`Deleted task ${args.id}`);
  }
}
