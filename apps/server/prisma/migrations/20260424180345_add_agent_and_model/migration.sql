/*
  Warnings:

  - Added the required column `agentId` to the `tasks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `model` to the `tasks` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_name_key" ON "agents"("name");

-- Seed default agents
INSERT INTO "agents" ("id", "name", "tag", "model") VALUES
    ('claude-code-agent', 'Claude Code', 'claude-code', 'kimi-k2.6:cloud'),
    ('copilot-cli-agent', 'Copilot CLI', 'copilot-cli', 'kimi-k2.6:cloud');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "defaultAgentId" TEXT,
ADD COLUMN     "defaultModel" TEXT;

-- AlterTable (nullable first)
ALTER TABLE "tasks" ADD COLUMN     "agentId" TEXT,
ADD COLUMN     "model" TEXT;

-- Update existing tasks with default agent and model
UPDATE "tasks" SET "agentId" = 'claude-code-agent', "model" = 'kimi-k2.6:cloud';

-- Make columns NOT NULL
ALTER TABLE "tasks" ALTER COLUMN "agentId" SET NOT NULL,
ALTER COLUMN "model" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_defaultAgentId_fkey" FOREIGN KEY ("defaultAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
