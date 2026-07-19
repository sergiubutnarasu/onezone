-- Add `bypass` flag to tasks and task_schedules. When enabled, the task
-- runner executes only the task's own instructions (name/description +
-- project details), skipping kanban column instructions and column
-- traversal, then marks the task as finished immediately after the run.

ALTER TABLE "tasks" ADD COLUMN "bypass" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "task_schedules" ADD COLUMN "bypass" BOOLEAN NOT NULL DEFAULT false;
