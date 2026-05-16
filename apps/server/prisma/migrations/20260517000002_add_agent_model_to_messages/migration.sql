-- AlterTable: add agentId and model to messages
ALTER TABLE "messages" ADD COLUMN "agentId" TEXT;
ALTER TABLE "messages" ADD COLUMN "model" TEXT;
