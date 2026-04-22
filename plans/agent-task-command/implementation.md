# Agent Task CLI Command

## Goal
Add `task list`, `task create`, and `task status` subcommands to the agent CLI, each backed by HTTP calls to the server's existing task endpoints.

## Prerequisites
Make sure you are currently on the `feat/agent-task-command` branch before beginning implementation.
If not, move to the correct branch. If the branch does not exist, create it from main.

```bash
git checkout feat/agent-task-command
# or, if it doesn't exist:
git checkout -b feat/agent-task-command
```

---

### Step-by-Step Instructions

#### Step 1: Add `task list` command

- [x] Create the file `apps/agent/src/commands/task/list.ts` (create the `task/` folder — oclif automatically treats subfolders as topics with `topicSeparator: " "`).
- [x] Copy and paste the code below into `apps/agent/src/commands/task/list.ts`:

```typescript
import { Command, Flags } from "@oclif/core";
import { Task } from "@onezone/shared";

export default class TaskList extends Command {
  static description = "List all tasks for a project";

  static examples = [
    "<%= config.bin %> task list --project <uuid>",
    "<%= config.bin %> task list --project <uuid> --server http://localhost:5026",
  ];

  static flags = {
    project: Flags.string({
      description: "Project ID (UUID)",
      required: true,
    }),
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TaskList);

    let tasks: Task[];
    try {
      const response = await fetch(
        `${flags.server}/projects/${flags.project}/tasks`,
      );
      if (!response.ok) {
        this.error(
          `Server returned ${response.status}: ${response.statusText}`,
          { exit: 1 },
        );
      }
      tasks = (await response.json()) as Task[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    if (tasks.length === 0) {
      this.log("No tasks found.");
      return;
    }

    const idWidth = Math.max(36, ...tasks.map((t) => t.id.length));
    const nameWidth = Math.max(4, ...tasks.map((t) => t.name.length));
    const statusWidth = Math.max(6, ...tasks.map((t) => t.status.length));

    const header =
      "ID".padEnd(idWidth) +
      "  " +
      "Name".padEnd(nameWidth) +
      "  " +
      "Status".padEnd(statusWidth);
    const divider =
      "-".repeat(idWidth) +
      "  " +
      "-".repeat(nameWidth) +
      "  " +
      "-".repeat(statusWidth);

    this.log(header);
    this.log(divider);

    for (const task of tasks) {
      this.log(
        task.id.padEnd(idWidth) +
          "  " +
          task.name.padEnd(nameWidth) +
          "  " +
          task.status,
      );
    }

    this.log(divider);
  }
}
```

##### Step 1 Verification Checklist
- [x] No TypeScript errors: run `pnpm build` inside `apps/agent/` and confirm it exits cleanly.
- [ ] Run `pnpm dev task list --project <uuid>` (with a valid project UUID from the running server) and confirm a table is printed.
- [ ] Run `pnpm dev task list --project <uuid>` with a non-existent project UUID and confirm a clean error message (no stack trace).
- [ ] Run `pnpm dev task list` (missing `--project`) and confirm oclif's built-in required-flag error appears.

#### Step 1 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 2: Add `task create` command

- [x] Create the file `apps/agent/src/commands/task/create.ts`.
- [x] Copy and paste the code below into `apps/agent/src/commands/task/create.ts`:

```typescript
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
```

##### Step 2 Verification Checklist
- [x] No TypeScript errors: run `pnpm build` inside `apps/agent/` and confirm it exits cleanly.
- [ ] Run `pnpm dev task create --project <uuid> --name "Test task"` and confirm it prints a task UUID.
- [ ] Run `pnpm dev task list --project <uuid>` and confirm the new task appears in the table.
- [ ] Run `pnpm dev task create --project <uuid> --name "Assigned task" --agent <agentUuid>` and verify the task is created (check via `task list` or web UI).
- [ ] Run `pnpm dev task create --project <uuid>` (missing `--name`) and confirm oclif's required-flag error appears.

#### Step 2 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 3: Add `task status` command

- [x] Create the file `apps/agent/src/commands/task/status.ts`.
- [x] Copy and paste the code below into `apps/agent/src/commands/task/status.ts`:

```typescript
import { Command, Flags } from "@oclif/core";
import { TaskStatus } from "@onezone/shared";

export default class TaskStatusCommand extends Command {
  static description = "Update the status of a task";

  static examples = [
    "<%= config.bin %> task status --task <uuid> --status IN_PROGRESS",
    "<%= config.bin %> task status --task <uuid> --status DONE",
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
    const { flags } = await this.parse(TaskStatusCommand);

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
```

##### Step 3 Verification Checklist
- [x] No TypeScript errors: run `pnpm build` inside `apps/agent/` and confirm it exits cleanly.
- [ ] Run `pnpm dev task status --task <uuid> --status IN_PROGRESS` and confirm the confirmation message is printed.
- [ ] Run `pnpm dev task list --project <uuid>` and confirm the task's status column now shows `IN_PROGRESS`.
- [ ] Run `pnpm dev task status --task <uuid> --status INVALID_VALUE` and confirm oclif rejects the value **before** any network call is made (flag-level `options` validation).
- [ ] Run `pnpm dev task status` (missing both flags) and confirm oclif's required-flag error appears.

#### Step 3 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.
