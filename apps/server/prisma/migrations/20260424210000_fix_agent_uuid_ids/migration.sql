-- Replace non-UUID agent IDs with proper UUIDs and update all FK references in-place.

-- Step 1: Drop FK constraints so we can update the PK
ALTER TABLE "projects" DROP CONSTRAINT "projects_defaultAgentId_fkey";
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_agentId_fkey";

-- Step 2: Build a UUID mapping in a temp table (UUIDs generated once, reused consistently)
CREATE TEMP TABLE _agent_id_map AS
  SELECT id AS old_id, gen_random_uuid()::text AS new_id
  FROM "agents"
  WHERE id IN ('claude-code-agent', 'copilot-cli-agent');

-- Step 3: Update FK references in projects and tasks
UPDATE "projects" p
  SET "defaultAgentId" = m.new_id
  FROM _agent_id_map m
  WHERE p."defaultAgentId" = m.old_id;

UPDATE "tasks" t
  SET "agentId" = m.new_id
  FROM _agent_id_map m
  WHERE t."agentId" = m.old_id;

-- Step 4: Update agent IDs in-place
UPDATE "agents" a
  SET id = m.new_id
  FROM _agent_id_map m
  WHERE a.id = m.old_id;

-- Step 5: Re-add FK constraints
ALTER TABLE "projects" ADD CONSTRAINT "projects_defaultAgentId_fkey"
  FOREIGN KEY ("defaultAgentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
