import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthenticatedFetch = vi.fn();

vi.mock('./config.js', () => ({
  authenticatedFetch: (...args: unknown[]) => mockAuthenticatedFetch(...args),
}));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    hostname: () => 'test-hostname',
  };
});

import { registerTerminal } from './terminal-registration.js';

describe('terminal-registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns terminal id on successful registration', async () => {
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'term-123' }),
    });

    const result = await registerTerminal({ serverUrl: 'http://localhost:3000', name: 'test-terminal' });

    expect(result).toBe('term-123');
    expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
      'http://localhost:3000/terminals/register',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test-terminal', hostname: 'test-hostname' }),
      }),
      'http://localhost:3000',
    );
  });

  it('throws auth error on 401', async () => {
    mockAuthenticatedFetch.mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(
      registerTerminal({ serverUrl: 'http://localhost:3000', name: 'test-terminal' }),
    ).rejects.toThrow('Authentication failed. Run "onezone-terminal login" to re-authenticate.');
  });

  it('throws already connected error on 409 with message', async () => {
    mockAuthenticatedFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: 'Terminal already connected elsewhere' }),
    });

    await expect(
      registerTerminal({ serverUrl: 'http://localhost:3000', name: 'test-terminal' }),
    ).rejects.toThrow('Terminal already connected elsewhere');
  });

  it('throws generic already connected error on 409 without message', async () => {
    mockAuthenticatedFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({}),
    });

    await expect(
      registerTerminal({ serverUrl: 'http://localhost:3000', name: 'test-terminal' }),
    ).rejects.toThrow('Terminal "test-terminal" is already connected.');
  });

  it('throws generic server error on other non-ok status', async () => {
    mockAuthenticatedFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(
      registerTerminal({ serverUrl: 'http://localhost:3000', name: 'test-terminal' }),
    ).rejects.toThrow('Server registration failed (HTTP 500)');
  });

  it('throws reach error when authenticatedFetch throws with server unreachable', async () => {
    mockAuthenticatedFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      registerTerminal({ serverUrl: 'http://localhost:3000', name: 'test-terminal' }),
    ).rejects.toThrow('Could not reach server at http://localhost:3000: ECONNREFUSED');
  });

  it('throws auth error when authenticatedFetch throws with not authenticated', async () => {
    mockAuthenticatedFetch.mockRejectedValue(new Error('Not authenticated. Run login first.'));

    await expect(
      registerTerminal({ serverUrl: 'http://localhost:3000', name: 'test-terminal' }),
    ).rejects.toThrow('Not authenticated. Run "onezone-terminal login" first.');
  });

  it('throws reach error when authenticatedFetch throws non-Error', async () => {
    mockAuthenticatedFetch.mockRejectedValue('plain string error');

    await expect(
      registerTerminal({ serverUrl: 'http://localhost:3000', name: 'test-terminal' }),
    ).rejects.toThrow('Could not reach server at http://localhost:3000: plain string error');
  });
});
