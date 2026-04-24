/*
  Warnings:

  - Made the column `defaultAgentId` on table `projects` required. This step will fail if there are existing NULL values in that column.
  - Made the column `defaultModel` on table `projects` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_defaultAgentId_fkey";

-- Update existing projects with default agent and model
UPDATE "projects" SET "defaultAgentId" = 'claude-code-agent', "defaultModel" = 'kimi-k2.6:cloud' WHERE "defaultAgentId" IS NULL;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "defaultAgentId" SET NOT NULL,
ALTER COLUMN "defaultModel" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_defaultAgentId_fkey" FOREIGN KEY ("defaultAgentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
