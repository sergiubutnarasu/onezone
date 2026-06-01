-- Store per-user agent model preferences without mutating global Agent rows.

CREATE TABLE "user_agent_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_agent_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_agent_settings_userId_agentId_key" ON "user_agent_settings"("userId", "agentId");
CREATE INDEX "user_agent_settings_agentId_idx" ON "user_agent_settings"("agentId");

ALTER TABLE "user_agent_settings" ADD CONSTRAINT "user_agent_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_agent_settings" ADD CONSTRAINT "user_agent_settings_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;