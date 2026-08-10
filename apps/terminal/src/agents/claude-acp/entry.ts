import { createRequire } from 'node:module';
import { existsSync, realpathSync } from 'node:fs';

const require = createRequire(import.meta.url);

export function resolveAgentEntry(): string {
  const candidates = [
    // Adapter as a library: entry is dist/index.js next to its package.json.
    resolveAdapterEntry(),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return realpathSync(candidate);
  }
  throw new Error(
    'claude-agent-acp entry not found; ensure @agentclientprotocol/claude-agent-acp is installed',
  );
}

function resolveAdapterEntry(): string {
  try {
    return require.resolve('@agentclientprotocol/claude-agent-acp/dist/index.js');
  } catch {
    throw new Error(
      'claude-agent-acp entry not found; ensure @agentclientprotocol/claude-agent-acp is installed',
    );
  }
}
