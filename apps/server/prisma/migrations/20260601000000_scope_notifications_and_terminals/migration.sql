-- Scope notifications to the owning user and terminal names to each user.

ALTER TABLE "notifications" ADD COLUMN "userId" TEXT;

UPDATE "notifications" AS n
SET "userId" = p."userId"
FROM "projects" AS p
WHERE n."projectId" = p."id";

ALTER TABLE "notifications" ALTER COLUMN "userId" SET NOT NULL;

DROP INDEX IF EXISTS "terminals_name_key";
CREATE UNIQUE INDEX "terminals_userId_name_key" ON "terminals"("userId", "name");

CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;