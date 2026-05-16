-- AlterTable: add agent and model overrides to kanban_columns
ALTER TABLE "kanban_columns" ADD COLUMN "agentId" TEXT;
ALTER TABLE "kanban_columns" ADD COLUMN "model" TEXT;

-- AddForeignKey
ALTER TABLE "kanban_columns" ADD CONSTRAINT "kanban_columns_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: add useTaskAgentAndModel flag to tasks
ALTER TABLE "tasks" ADD COLUMN "useTaskAgentAndModel" BOOLEAN NOT NULL DEFAULT false;
