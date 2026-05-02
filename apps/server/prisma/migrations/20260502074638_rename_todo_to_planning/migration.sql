/*
  Warnings:

  - The values [TODO] on the enum `TaskStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum: rename value TODO -> PLANNING (safe, preserves existing rows)
ALTER TYPE "TaskStatus" RENAME VALUE 'TODO' TO 'PLANNING';

