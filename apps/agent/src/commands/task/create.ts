import { Command, Flags } from "@oclif/core";
import { Task } from "@onezone/shared";

export default class TaskCreate extends Command {
  static description = "Create a new task in a project";

  static examples = [
    '<%= config.bin %> task create --project <uuid> --name "My task"',
    '<%= config.bin %> task create --project <uuid> --name "My task" --description "Details" --agent <agentUuid>',
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
    agent: Flags.string({
      description: "Agent ID (UUID) to assign to this task",
      required: false,
    }),
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TaskCreate);

    const body: { name: string; description?: string; agentId?: string } = {
      name: flags.name,
    };
    if (flags.description) body.description = flags.description;
    if (flags.agent) body.agentId = flags.agent;

    let task: Task;
    try {
      const response = await fetch(
        `${flags.server}/projects/${flags.project}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
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
