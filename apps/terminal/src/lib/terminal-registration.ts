// apps/terminal/src/lib/terminal-registration.ts

import { hostname } from 'node:os';
import { getAccessToken } from './config.js';

export interface RegisterTerminalInput {
  serverUrl: string;
  name: string;
}

/**
 * Registers the terminal with the server via HTTP POST /terminals/register.
 * Returns the terminalId on success, throws on failure.
 */
export async function registerTerminal(input: RegisterTerminalInput): Promise<string> {
  const { serverUrl, name } = input;
  const url = `${serverUrl}/terminals/register`;
  const token = getAccessToken();

  if (!token) {
    throw new Error('Not authenticated. Run "onezone-terminal login" first.');
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name, hostname: hostname() }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not reach server at ${serverUrl}: ${message}`);
  }

  if (response.status === 401) {
    throw new Error('Authentication failed. Run "onezone-terminal login" to re-authenticate.');
  }

  if (response.status === 409) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Terminal "${name}" is already connected.`);
  }

  if (!response.ok) {
    throw new Error(`Server registration failed (HTTP ${response.status})`);
  }

  const terminal = await response.json() as { id: string };
  return terminal.id;
}
