import { createRequire } from 'node:module';
import { existsSync, realpathSync } from 'node:fs';
import * as path from 'node:path';

const require = createRequire(import.meta.url);

export function resolveAgentEntry(): string {
  const candidates = [
    // Adapter as a library: entry is dist/index.js next to its package.json.
    require.resolve('@agentclientprotocol/claude-agent-acp/dist/index.js'),
  ];
  // Fallback: the adapter ships a CLI binary; prefer the JS entry so `node`
  // can spawn it with our env without a shebang dependency.
  for (const candidate of candidates) {
    if (existsSync(candidate)) return realpathSync(candidate);
  }
  throw new Error(
    'claude-agent-acp entry not found; ensure @agentclientprotocol/claude-agent-acp is installed',
  );
}
