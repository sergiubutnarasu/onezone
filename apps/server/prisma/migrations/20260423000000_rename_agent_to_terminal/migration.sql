-- Rename agents table to terminals
ALTER TABLE "agents" RENAME TO "terminals";

-- Rename agentId column in tasks to terminalId
ALTER TABLE "tasks" RENAME COLUMN "agentId" TO "terminalId";

-- Rename agentId and agentName columns in messages
ALTER TABLE "messages" RENAME COLUMN "agentId" TO "terminalId";
ALTER TABLE "messages" RENAME COLUMN "agentName" TO "terminalName";
