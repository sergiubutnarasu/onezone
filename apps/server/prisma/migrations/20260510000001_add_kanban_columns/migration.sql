-- CreateTable
CREATE TABLE "kanban_columns" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "index" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kanban_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_columns" (
    "taskId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_columns_pkey" PRIMARY KEY ("taskId")
);

-- CreateIndex
CREATE INDEX "kanban_columns_projectId_idx" ON "kanban_columns"("projectId");

-- CreateIndex
CREATE INDEX "kanban_columns_index_idx" ON "kanban_columns"("index");

-- CreateIndex
CREATE INDEX "task_columns_columnId_idx" ON "task_columns"("columnId");

-- AddForeignKey
ALTER TABLE "kanban_columns" ADD CONSTRAINT "kanban_columns_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_columns" ADD CONSTRAINT "task_columns_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_columns" ADD CONSTRAINT "task_columns_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "kanban_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Remove status column from tasks
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "status";

-- DropEnum
DROP TYPE IF EXISTS "TaskStatus";
