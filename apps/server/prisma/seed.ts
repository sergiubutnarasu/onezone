import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  const agents = [
    { id: randomUUID(), name: 'Claude Code', tag: 'claude-code', model: 'kimi-k2.6:cloud' },
    { id: randomUUID(), name: 'Copilot CLI', tag: 'copilot-cli', model: 'kimi-k2.6:cloud' },
  ];

  for (const agent of agents) {
    await prisma.agent.upsert({
      where: { name: agent.name },
      update: {},
      create: agent,
    });
  }

  console.log('Seeded agents:', agents.map((a) => a.name).join(', '));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
