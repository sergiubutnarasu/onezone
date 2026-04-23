-- AlterTable
ALTER TABLE "terminals" RENAME CONSTRAINT "agents_pkey" TO "terminals_pkey";

-- RenameForeignKey
ALTER TABLE "tasks" RENAME CONSTRAINT "tasks_agentId_fkey" TO "tasks_terminalId_fkey";

-- RenameIndex
ALTER INDEX "agents_name_key" RENAME TO "terminals_name_key";
