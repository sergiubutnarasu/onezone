/*
  Warnings:

  - The `messageType` column on the `messages` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('COMMAND_START', 'COMMAND_EXIT');

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "messageType",
ADD COLUMN     "messageType" "MessageType";
