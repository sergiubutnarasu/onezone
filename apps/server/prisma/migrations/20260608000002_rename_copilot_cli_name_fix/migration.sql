-- Rename agent name from 'Copilot CLI' to 'Github Copilot CLI' to match the updated seed.
UPDATE "agents" SET name = 'Github Copilot CLI' WHERE name = 'Copilot CLI';
