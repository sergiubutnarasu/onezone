import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetPassword = vi.fn();
const mockSetPassword = vi.fn();
const mockDeletePassword = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();
const mockRm = vi.fn();

vi.doMock('@napi-rs/keyring', () => ({
  Entry: vi.fn().mockImplementation(() => ({
    getPassword: mockGetPassword,
    setPassword: mockSetPassword,
    deletePassword: mockDeletePassword,
  })),
}));

vi.doMock('node:fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  rm: mockRm,
}));

vi.doMock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: () => '/test/home',
  };
});

describe('config', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetPassword.mockReset();
    mockSetPassword.mockReset();
    mockDeletePassword.mockReset();
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
    mockMkdir.mockReset();
    mockRm.mockReset();
  });

  describe('getAccessToken', () => {
    it('returns token from keychain when available', async () => {
      mockGetPassword.mockResolvedValue('keychain-token');
      const { getAccessToken } = await import('./config.js');
      const token = await getAccessToken();
      expect(token).toBe('keychain-token');
      expect(mockGetPassword).toHaveBeenCalledTimes(1);
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('falls back to file when keychain fails', async () => {
      mockGetPassword.mockRejectedValue(new Error('keyring error'));
      mockReadFile.mockResolvedValue(JSON.stringify({ access_token: 'file-token' }));
      const { getAccessToken } = await import('./config.js');
      const token = await getAccessToken();
      expect(token).toBe('file-token');
    });

    it('returns undefined when neither keychain nor file has token', async () => {
      mockGetPassword.mockRejectedValue(new Error('keyring error'));
      mockReadFile.mockRejectedValue(new Error('no file'));
      const { getAccessToken } = await import('./config.js');
      const token = await getAccessToken();
      expect(token).toBeUndefined();
    });

    it('returns undefined when file exists but has no access_token', async () => {
      mockGetPassword.mockRejectedValue(new Error('keyring error'));
      mockReadFile.mockResolvedValue(JSON.stringify({ refresh_token: 'only-refresh' }));
      const { getAccessToken } = await import('./config.js');
      const token = await getAccessToken();
      expect(token).toBeUndefined();
    });
  });

  describe('getRefreshToken', () => {
    it('returns token from keychain when available', async () => {
      mockGetPassword.mockResolvedValue('refresh-keychain');
      const { getRefreshToken } = await import('./config.js');
      const token = await getRefreshToken();
      expect(token).toBe('refresh-keychain');
    });

    it('falls back to file when keychain fails', async () => {
      mockGetPassword.mockRejectedValue(new Error('keyring error'));
      mockReadFile.mockResolvedValue(JSON.stringify({ refresh_token: 'refresh-file' }));
      const { getRefreshToken } = await import('./config.js');
      const token = await getRefreshToken();
      expect(token).toBe('refresh-file');
    });
  });

  describe('setTokens', () => {
    it('stores tokens in keychain when keyring works', async () => {
      mockSetPassword.mockResolvedValue(undefined);
      const { setTokens } = await import('./config.js');
      await setTokens('access-123', 'refresh-456');
      expect(mockSetPassword).toHaveBeenCalledTimes(2);
      expect(mockSetPassword).toHaveBeenNthCalledWith(1, 'access-123');
      expect(mockSetPassword).toHaveBeenNthCalledWith(2, 'refresh-456');
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('falls back to file when keyring fails', async () => {
      mockSetPassword.mockRejectedValue(new Error('keyring error'));
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
      const { setTokens } = await import('./config.js');
      await setTokens('access-123', 'refresh-456');
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/home/.onezone/tokens.json',
        JSON.stringify({ access_token: 'access-123', refresh_token: 'refresh-456' }),
        { mode: 0o600 },
      );
      expect(mockMkdir).toHaveBeenCalledWith('/test/home/.onezone', { recursive: true });
    });
  });

  describe('clearTokens', () => {
    it('deletes keychain entries and token file', async () => {
      mockDeletePassword.mockResolvedValue(undefined);
      mockRm.mockResolvedValue(undefined);
      const { clearTokens } = await import('./config.js');
      await clearTokens();
      expect(mockDeletePassword).toHaveBeenCalledTimes(2);
      expect(mockRm).toHaveBeenCalledWith('/test/home/.onezone/tokens.json');
    });

    it('succeeds even if keychain deletion fails', async () => {
      mockDeletePassword.mockRejectedValue(new Error('keyring error'));
      mockRm.mockResolvedValue(undefined);
      const { clearTokens } = await import('./config.js');
      await expect(clearTokens()).resolves.not.toThrow();
      expect(mockDeletePassword).toHaveBeenCalledTimes(2);
    });

    it('succeeds even if file deletion fails', async () => {
      mockDeletePassword.mockResolvedValue(undefined);
      mockRm.mockRejectedValue(new Error('no file'));
      const { clearTokens } = await import('./config.js');
      await expect(clearTokens()).resolves.not.toThrow();
      expect(mockRm).toHaveBeenCalledWith('/test/home/.onezone/tokens.json');
    });
  });

  describe('refreshAccessToken', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('returns false when no refresh token exists', async () => {
      mockGetPassword.mockRejectedValue(new Error('keyring error'));
      mockReadFile.mockRejectedValue(new Error('no file'));
      const { refreshAccessToken } = await import('./config.js');
      const result = await refreshAccessToken('http://localhost:3000');
      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('refreshes token successfully', async () => {
      // refreshAccessToken calls getRefreshToken once (calls getPassword once)
      mockGetPassword.mockResolvedValue('refresh-123');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh' }),
      });
      mockSetPassword.mockResolvedValue(undefined);

      const { refreshAccessToken } = await import('./config.js');
      const result = await refreshAccessToken('http://localhost:3000');
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/auth/refresh',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: 'refresh-123' }),
        }),
      );
      expect(mockSetPassword).toHaveBeenCalledWith('new-access');
      expect(mockSetPassword).toHaveBeenCalledWith('new-refresh');
    });

    it('returns false when server returns non-ok', async () => {
      mockGetPassword.mockResolvedValue('refresh-123');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const { refreshAccessToken } = await import('./config.js');
      const result = await refreshAccessToken('http://localhost:3000');
      expect(result).toBe(false);
    });

    it('returns false when response lacks access_token', async () => {
      mockGetPassword.mockResolvedValue('refresh-123');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ refresh_token: 'new-refresh' }),
      });

      const { refreshAccessToken } = await import('./config.js');
      const result = await refreshAccessToken('http://localhost:3000');
      expect(result).toBe(false);
    });

    it('deduplicates concurrent refresh calls', async () => {
      mockGetPassword.mockResolvedValue('refresh-123');
      let resolveFetch: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(fetchPromise);

      const { refreshAccessToken } = await import('./config.js');

      const promise1 = refreshAccessToken('http://localhost:3000');
      const promise2 = refreshAccessToken('http://localhost:3000');

      // Need to wait a tick for the async function to reach the first await
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(global.fetch).toHaveBeenCalledTimes(1);

      resolveFetch!({
        ok: true,
        json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh' }),
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns false when fetch throws', async () => {
      mockGetPassword.mockResolvedValue('refresh-123');
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));

      const { refreshAccessToken } = await import('./config.js');
      const result = await refreshAccessToken('http://localhost:3000');
      expect(result).toBe(false);
    });
  });

  describe('authenticatedFetch', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('throws when no access token exists', async () => {
      mockGetPassword.mockRejectedValue(new Error('keyring error'));
      mockReadFile.mockRejectedValue(new Error('no file'));

      const { authenticatedFetch } = await import('./config.js');
      await expect(
        authenticatedFetch('http://localhost:3000/api/test', {}, 'http://localhost:3000'),
      ).rejects.toThrow('Not authenticated. Run login first.');
    });

    it('makes request with Bearer token header', async () => {
      mockGetPassword.mockResolvedValue('token-123');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const { authenticatedFetch } = await import('./config.js');
      await authenticatedFetch('http://localhost:3000/api/test', {}, 'http://localhost:3000');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          headers: { Authorization: 'Bearer token-123' },
        }),
      );
    });

    it('merges existing headers with Authorization', async () => {
      mockGetPassword.mockResolvedValue('token-123');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const { authenticatedFetch } = await import('./config.js');
      await authenticatedFetch(
        'http://localhost:3000/api/test',
        { headers: { 'X-Custom': 'value' } },
        'http://localhost:3000',
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          headers: { 'X-Custom': 'value', Authorization: 'Bearer token-123' },
        }),
      );
    });

    it('retries after token refresh on 401', async () => {
      // authenticatedFetch calls getAccessToken first, then if 401 calls refreshAccessToken
      // refreshAccessToken calls getRefreshToken, then setTokens, then getAccessToken again
      // Sequence: getAccessToken → getPassword (old-token)
      //           getRefreshToken → getPassword (refresh-123)
      //           setTokens → setPassword (new-access), setPassword (new-refresh)
      //           getAccessToken again → getPassword (new-token)
      mockGetPassword
        .mockResolvedValueOnce('old-token')    // first getAccessToken
        .mockResolvedValueOnce('refresh-123')  // getRefreshToken inside refreshAccessToken
        .mockResolvedValueOnce('new-token');   // second getAccessToken after refresh

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ access_token: 'new-token', refresh_token: 'new-refresh' }),
          });
        }
        if (url.includes('/api/test')) {
          const apiTestCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
            .filter((call: unknown[]) => (call[0] as string).includes('/api/test'));
          if (apiTestCalls.length === 1) {
            return Promise.resolve({ ok: false, status: 401 });
          }
          return Promise.resolve({ ok: true, status: 200 });
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const { authenticatedFetch } = await import('./config.js');
      const result = await authenticatedFetch(
        'http://localhost:3000/api/test',
        {},
        'http://localhost:3000',
      );
      expect(result.status).toBe(200);
    });

    it('throws when 401 and refresh fails', async () => {
      mockGetPassword
        .mockResolvedValueOnce('old-token')
        .mockResolvedValueOnce('refresh-123');

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('/auth/refresh')) {
          return Promise.resolve({ ok: false, status: 401 });
        }
        return Promise.resolve({ ok: false, status: 401 });
      });

      const { authenticatedFetch } = await import('./config.js');
      await expect(
        authenticatedFetch('http://localhost:3000/api/test', {}, 'http://localhost:3000'),
      ).rejects.toThrow('Not authenticated. Run login first.');
    });

    it('returns response for successful non-401 requests', async () => {
      mockGetPassword.mockResolvedValue('token-123');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' }),
      });

      const { authenticatedFetch } = await import('./config.js');
      const result = await authenticatedFetch('http://localhost:3000/api/test', {}, 'http://localhost:3000');
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
    });
  });
});
