// apps/agent/src/lib/agent-registration.ts

import { hostname } from 'node:os';

export interface RegisterAgentInput {
  serverUrl: string;
  name: string;
}

/**
 * Registers the agent with the server via HTTP POST /agents/register.
 * Returns the agentId on success, throws on failure.
 */
export async function registerAgent(input: RegisterAgentInput): Promise<string> {
  const { serverUrl, name } = input;
  const url = `${serverUrl}/agents/register`;
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, hostname: hostname() }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not reach server at ${serverUrl}: ${message}`);
  }

  if (response.status === 409) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Agent "${name}" is already connected.`);
  }

  if (!response.ok) {
    throw new Error(`Server registration failed (HTTP ${response.status})`);
  }

  const agent = await response.json() as { id: string };
  return agent.id;
}
