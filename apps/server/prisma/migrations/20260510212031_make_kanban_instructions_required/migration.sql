/*
  Warnings:

  - Made the column `instructions` on table `kanban_columns` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill NULL values before making column required
UPDATE "kanban_columns" SET "instructions" = '' WHERE "instructions" IS NULL;

-- AlterTable
ALTER TABLE "kanban_columns" ALTER COLUMN "instructions" SET NOT NULL,
ALTER COLUMN "instructions" SET DEFAULT '';
