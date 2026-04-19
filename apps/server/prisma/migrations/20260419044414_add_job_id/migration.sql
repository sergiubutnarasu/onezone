-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "jobId" TEXT;

-- CreateIndex
CREATE INDEX "messages_jobId_idx" ON "messages"("jobId");
