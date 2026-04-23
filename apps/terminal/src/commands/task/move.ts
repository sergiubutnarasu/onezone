import { Command, Flags } from "@oclif/core";
import { TaskStatus } from "@onezone/shared";

export default class TaskMoveCommand extends Command {
  static description = "Update the status of a task";

  static examples = [
    "<%= config.bin %> task move --task <uuid> --status IN_PROGRESS",
    "<%= config.bin %> task move --task <uuid> --status DONE",
  ];

  static flags = {
    task: Flags.string({
      description: "Task ID (UUID)",
      required: true,
    }),
    status: Flags.string({
      description: `New status. One of: ${Object.values(TaskStatus).join(", ")}`,
      required: true,
      options: Object.values(TaskStatus),
    }),
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TaskMoveCommand);

    try {
      const response = await fetch(
        `${flags.server}/tasks/${flags.task}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: flags.status }),
        },
      );
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

    this.log(`Task ${flags.task} status updated to ${flags.status}.`);
  }
}
