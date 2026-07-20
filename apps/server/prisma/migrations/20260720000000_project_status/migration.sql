CREATE TYPE "ProjectStatus" AS ENUM ('pending', 'ready', 'failed');

ALTER TABLE "projects" ADD COLUMN "status" "ProjectStatus" NOT NULL DEFAULT 'ready';