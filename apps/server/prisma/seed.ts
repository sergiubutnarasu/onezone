import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
// Import from the compiled output so this script works both in dev (after
// `pnpm build`) and inside the deployed Docker image, which only ships `dist/`.
import { DEFAULT_KANBAN_COLUMNS } from '../dist/projects/constants.js';

const prisma = new PrismaClient();

async function main() {
  const agents = [
    { id: randomUUID(), name: 'Claude Code', tag: 'claude-code', model: 'kimi-k2.6:cloud' },
    { id: randomUUID(), name: 'Github Copilot CLI', tag: 'github-copilot-cli', model: 'kimi-k2.6:cloud' },
    { id: randomUUID(), name: 'Opencode', tag: 'opencode', model: 'kimi-k2.6:cloud' },
  ];

  for (const agent of agents) {
    await prisma.agent.upsert({
      where: { name: agent.name },
      update: {},
      create: agent,
    });
  }

  console.log('Seeded agents:', agents.map((a) => a.name).join(', '));

  // Backfill default kanban columns for any existing projects that have none.
  // New projects already get columns via KanbanColumnsService.createDefaults.
  const projects = await prisma.project.findMany({ select: { id: true, name: true, userId: true } });
  for (const project of projects) {
    const existing = await prisma.kanbanColumn.count({ where: { projectId: project.id } });
    if (existing === 0) {
      await prisma.kanbanColumn.createMany({
        data: DEFAULT_KANBAN_COLUMNS.map((col) => ({
          ...col,
          id: randomUUID(),
          projectId: project.id,
          userId: project.userId,
        })),
      });
      console.log(`Seeded default kanban columns for project "${project.name}"`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

