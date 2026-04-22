# Agent List Command

## Goal
Add an `agents list` CLI command that fetches all agents from the server and displays their ID, name, and connection status in a formatted table.

## Prerequisites
Make sure you are currently on the `feat/agent-list-command` branch before beginning implementation.
If not, move to the correct branch. If the branch does not exist, create it from main.

```bash
git checkout feat/agent-list-command
# or if it doesn't exist:
git checkout -b feat/agent-list-command
```

---

### Step-by-Step Instructions

#### Step 1: Create `agents/list` command

- [x] Create the directory `apps/agent/src/commands/agents/` if it does not exist.
- [x] Create a new file at `apps/agent/src/commands/agents/list.ts` and paste the code below:

```typescript
import { Command, Flags } from '@oclif/core';
import { Agent } from '@onezone/shared';

export default class AgentsList extends Command {
  static description = 'List all agents registered on the server';

  static examples = [
    '<%= config.bin %> agents list',
    '<%= config.bin %> agents list --server http://localhost:5026',
  ];

  static flags = {
    server: Flags.string({
      description: 'Server URL',
      default: 'http://localhost:5026',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AgentsList);

    let agents: Agent[];
    try {
      const response = await fetch(`${flags.server}/agents`);
      if (!response.ok) {
        this.error(`Server returned ${response.status}: ${response.statusText}`, { exit: 1 });
      }
      agents = (await response.json()) as Agent[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    if (agents.length === 0) {
      this.log('No agents registered.');
      return;
    }

    const idWidth = Math.max(36, ...agents.map((a) => a.id.length));
    const nameWidth = Math.max(4, ...agents.map((a) => a.name.length));
    const statusWidth = 12;

    const header =
      'ID'.padEnd(idWidth) + '  ' + 'Name'.padEnd(nameWidth) + '  ' + 'Status'.padEnd(statusWidth);
    const divider =
      '-'.repeat(idWidth) + '  ' + '-'.repeat(nameWidth) + '  ' + '-'.repeat(statusWidth);

    this.log(header);
    this.log(divider);

    for (const agent of agents) {
      const status = agent.isConnected ? 'connected' : 'disconnected';
      this.log(
        agent.id.padEnd(idWidth) + '  ' + agent.name.padEnd(nameWidth) + '  ' + status,
      );
    }
  }
}
```

##### Step 1 Verification Checklist
- [x] No TypeScript build errors: run `pnpm build` from `apps/agent/`
- [ ] Run `pnpm dev agents list` from `apps/agent/` — with the server running, a table of agents is printed
- [ ] Run `pnpm dev agents list --server http://localhost:5026` — same result with explicit flag
- [ ] When no agents are registered, output is `No agents registered.`
- [ ] `connected` / `disconnected` status matches the agent's actual socket state

#### Step 1 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.
