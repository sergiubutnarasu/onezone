-- Rename agent tag from 'copilot-cli' to 'github-copilot-cli' to match the updated AgentTag enum.
UPDATE "agents" SET tag = 'github-copilot-cli' WHERE tag = 'copilot-cli';
