/*
  Warnings:

  - You are about to drop the column `inputTokens` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `outputTokens` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `totalCostUsd` on the `tasks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "totalCostUsd" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "inputTokens",
DROP COLUMN "outputTokens",
DROP COLUMN "totalCostUsd";
