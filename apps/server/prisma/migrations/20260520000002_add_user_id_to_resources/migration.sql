-- Add userId to projects (nullable first, then backfill, then NOT NULL)
ALTER TABLE "projects" ADD COLUMN "userId" TEXT;
UPDATE "projects" SET "userId" = (SELECT "id" FROM "users" LIMIT 1) WHERE "userId" IS NULL;
ALTER TABLE "projects" ALTER COLUMN "userId" SET NOT NULL;

-- Add userId to tasks
ALTER TABLE "tasks" ADD COLUMN "userId" TEXT;
UPDATE "tasks" SET "userId" = (SELECT "id" FROM "users" LIMIT 1) WHERE "userId" IS NULL;
ALTER TABLE "tasks" ALTER COLUMN "userId" SET NOT NULL;

-- Add userId to kanban_columns
ALTER TABLE "kanban_columns" ADD COLUMN "userId" TEXT;
UPDATE "kanban_columns" SET "userId" = (SELECT "id" FROM "users" LIMIT 1) WHERE "userId" IS NULL;
ALTER TABLE "kanban_columns" ALTER COLUMN "userId" SET NOT NULL;

-- Add userId to project_skills
ALTER TABLE "project_skills" ADD COLUMN "userId" TEXT;
UPDATE "project_skills" SET "userId" = (SELECT "id" FROM "users" LIMIT 1) WHERE "userId" IS NULL;
ALTER TABLE "project_skills" ALTER COLUMN "userId" SET NOT NULL;

-- Add userId to terminals
ALTER TABLE "terminals" ADD COLUMN "userId" TEXT;
UPDATE "terminals" SET "userId" = (SELECT "id" FROM "users" LIMIT 1) WHERE "userId" IS NULL;
ALTER TABLE "terminals" ALTER COLUMN "userId" SET NOT NULL;

-- Add userId to messages
ALTER TABLE "messages" ADD COLUMN "userId" TEXT;
UPDATE "messages" SET "userId" = (SELECT "id" FROM "users" LIMIT 1) WHERE "userId" IS NULL;
ALTER TABLE "messages" ALTER COLUMN "userId" SET NOT NULL;

-- Foreign key constraints
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kanban_columns" ADD CONSTRAINT "kanban_columns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_skills" ADD CONSTRAINT "project_skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "terminals" ADD CONSTRAINT "terminals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "projects_userId_idx" ON "projects"("userId");
CREATE INDEX "tasks_userId_idx" ON "tasks"("userId");
CREATE INDEX "kanban_columns_userId_idx" ON "kanban_columns"("userId");
CREATE INDEX "project_skills_userId_idx" ON "project_skills"("userId");
CREATE INDEX "terminals_userId_idx" ON "terminals"("userId");
CREATE INDEX "messages_userId_idx" ON "messages"("userId");
