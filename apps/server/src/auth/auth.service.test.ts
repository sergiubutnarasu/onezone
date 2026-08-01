import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';

vi.mock('bcryptjs', () => ({
  __esModule: true,
  hash: vi.fn(),
  compare: vi.fn(),
}));

vi.mock('../lib/web-origins.js', () => ({
  getWebOrigins: vi.fn().mockReturnValue(['http://localhost:3000']),
}));

const createMockPrisma = () => {
  const deviceCode = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  const user = {
    findUnique: vi.fn(),
    create: vi.fn(),
  };
  const refreshToken = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  return {
    deviceCode,
    user,
    refreshToken,
  } as unknown as PrismaService;
};

const createMockConfig = () =>
  ({
    getOrThrow: vi.fn().mockImplementation((key: string) => {
      switch (key) {
        case 'REFRESH_TOKEN_EXPIRES_IN': return '7d';
        default: throw new Error(`Missing config: ${key}`);
      }
    }),
    get: vi.fn().mockImplementation((key: string) => {
      switch (key) {
        case 'ADMIN_EMAILS': return 'admin@example.com';
        default: return undefined;
      }
    }),
  }) as unknown as ConfigService;

const createMockJwt = () =>
  ({
    sign: vi.fn().mockReturnValue('signed-access-token'),
  }) as unknown as JwtService;

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let jwt: ReturnType<typeof createMockJwt>;
  let config: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    jwt = createMockJwt();
    config = createMockConfig();
    service = new AuthService(prisma, jwt, config);
  });

  describe('createDeviceCode', () => {
    it('creates a device code with correct shape', async () => {
      prisma.deviceCode.create.mockResolvedValue({});
      const result = await service.createDeviceCode();

      expect(result).toHaveProperty('device_code');
      expect(result).toHaveProperty('user_code');
      expect(result).toHaveProperty('verification_uri');
      expect(result).toHaveProperty('expires_in', 600);
      expect(result).toHaveProperty('interval', 5);
      expect(prisma.deviceCode.create).toHaveBeenCalled();
    });

    it('uses the first web origin for verification URI', async () => {
      prisma.deviceCode.create.mockResolvedValue({});
      const result = await service.createDeviceCode();
      expect(result.verification_uri).toBe('http://localhost:3000/auth/activate');
    });
  });

  describe('pollToken', () => {
    it('returns invalid_grant when device code not found', async () => {
      prisma.deviceCode.findUnique.mockResolvedValue(null);
      const result = await service.pollToken('unknown-device-code');
      expect(result).toEqual({ error: 'invalid_grant' });
    });

    it('returns expired_token when code is expired', async () => {
      prisma.deviceCode.findUnique.mockResolvedValue({
        deviceCode: 'dc1',
        userCode: 'UC12-AB34',
        expiresAt: new Date(Date.now() - 1000),
        approved: false,
        userId: null,
        lastPolledAt: null,
      });
      const result = await service.pollToken('dc1');
      expect(result).toEqual({ error: 'expired_token' });
    });

    it('returns slow_down when polled too frequently', async () => {
      prisma.deviceCode.findUnique.mockResolvedValue({
        deviceCode: 'dc1',
        userCode: 'UC12-AB34',
        expiresAt: new Date(Date.now() + 60000),
        approved: false,
        userId: null,
        lastPolledAt: new Date(),
      });
      const result = await service.pollToken('dc1');
      expect(result).toEqual({ error: 'slow_down' });
    });

    it('returns authorization_pending when not approved', async () => {
      prisma.deviceCode.findUnique.mockResolvedValue({
        deviceCode: 'dc1',
        userCode: 'UC12-AB34',
        expiresAt: new Date(Date.now() + 60000),
        approved: false,
        userId: null,
        lastPolledAt: new Date(Date.now() - 10000),
      });
      prisma.deviceCode.update.mockResolvedValue({});
      const result = await service.pollToken('dc1');
      expect(result).toEqual({ error: 'authorization_pending' });
    });

    it('returns access_denied when approved but no userId', async () => {
      prisma.deviceCode.findUnique.mockResolvedValue({
        deviceCode: 'dc1',
        userCode: 'UC12-AB34',
        expiresAt: new Date(Date.now() + 60000),
        approved: true,
        userId: null,
        lastPolledAt: new Date(Date.now() - 10000),
      });
      prisma.deviceCode.update.mockResolvedValue({});
      const result = await service.pollToken('dc1');
      expect(result).toEqual({ error: 'access_denied' });
    });

    it('returns tokens when approved with userId', async () => {
      prisma.deviceCode.findUnique.mockResolvedValue({
        deviceCode: 'dc1',
        userCode: 'UC12-AB34',
        expiresAt: new Date(Date.now() + 60000),
        approved: true,
        userId: 'user-1',
        lastPolledAt: new Date(Date.now() - 10000),
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
      prisma.deviceCode.delete.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.pollToken('dc1');
      expect(result).toHaveProperty('access_token', 'signed-access-token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('returns access_denied when user not found', async () => {
      prisma.deviceCode.findUnique.mockResolvedValue({
        deviceCode: 'dc1',
        userCode: 'UC12-AB34',
        expiresAt: new Date(Date.now() + 60000),
        approved: true,
        userId: 'user-1',
        lastPolledAt: new Date(Date.now() - 10000),
      });
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.pollToken('dc1');
      expect(result).toEqual({ error: 'access_denied' });
    });
  });

  describe('approveDeviceCode', () => {
    it('returns false when code not found', async () => {
      prisma.deviceCode.findUnique.mockResolvedValue(null);
      const result = await service.approveDeviceCode('user-1', 'UC12-AB34');
      expect(result).toBe(false);
    });

    it('returns false when already approved', async () => {
      prisma.deviceCode.findUnique.mockResolvedValue({
        userCode: 'UC12-AB34',
        approved: true,
        expiresAt: new Date(Date.now() + 60000),
      });
      const result = await service.approveDeviceCode('user-1', 'UC12-AB34');
      expect(result).toBe(false);
    });

    it('returns false when expired', async () => {
      prisma.deviceCode.findUnique.mockResolvedValue({
        userCode: 'UC12-AB34',
        approved: false,
        expiresAt: new Date(Date.now() - 1000),
      });
      const result = await service.approveDeviceCode('user-1', 'UC12-AB34');
      expect(result).toBe(false);
    });

    it('returns true and updates record when valid', async () => {
      prisma.deviceCode.findUnique.mockResolvedValue({
        userCode: 'UC12-AB34',
        approved: false,
        expiresAt: new Date(Date.now() + 60000),
      });
      prisma.deviceCode.update.mockResolvedValue({});
      const result = await service.approveDeviceCode('user-1', 'UC12-AB34');
      expect(result).toBe(true);
      expect(prisma.deviceCode.update).toHaveBeenCalledWith({
        where: { userCode: 'UC12-AB34' },
        data: { approved: true, userId: 'user-1' },
      });
    });
  });

  describe('signup', () => {
    it('returns null when user already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      const result = await service.signup('test@example.com', 'password123', 'Test User');
      expect(result).toBeNull();
    });

    it('creates user and returns tokens for new user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
      prisma.user.create.mockResolvedValue({ id: 'user-new', email: 'new@example.com' });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.signup('new@example.com', 'password123', 'New User');
      expect(result).toHaveProperty('access_token', 'signed-access-token');
      expect(result).toHaveProperty('refresh_token');
    });
  });

  describe('login', () => {
    it('returns null when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.login('test@example.com', 'password123');
      expect(result).toBeNull();
    });

    it('returns null when password is invalid', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: 'hash' });
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      const result = await service.login('test@example.com', 'wrong-password');
      expect(result).toBeNull();
    });

    it('returns tokens for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: 'hash' });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login('test@example.com', 'password123');
      expect(result).toHaveProperty('access_token', 'signed-access-token');
      expect(result).toHaveProperty('refresh_token');
    });
  });

  describe('refreshToken', () => {
    it('returns null when token record not found', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      const result = await service.refreshToken('some-refresh-token');
      expect(result).toBeNull();
    });

    it('returns null when token is expired', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        token: 'hash',
        expiresAt: new Date(Date.now() - 1000),
        userId: 'user-1',
      });
      const result = await service.refreshToken('some-refresh-token');
      expect(result).toBeNull();
    });

    it('returns tokens for valid refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        token: 'hash',
        expiresAt: new Date(Date.now() + 60000),
        userId: 'user-1',
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshToken('some-refresh-token');
      expect(result).toHaveProperty('access_token', 'signed-access-token');
      expect(result).toHaveProperty('refresh_token');
    });
  });

  describe('logout', () => {
    it('deletes refresh token', async () => {
      prisma.refreshToken.delete.mockResolvedValue({});
      await service.logout('some-token');
      expect(prisma.refreshToken.delete).toHaveBeenCalled();
    });

    it('does not throw when delete fails', async () => {
      prisma.refreshToken.delete.mockRejectedValue(new Error('not found'));
      await expect(service.logout('some-token')).resolves.toBeUndefined();
    });
  });

  describe('getMe', () => {
    it('returns null when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.getMe('user-1');
      expect(result).toBeNull();
    });

    it('returns user with isAdmin flag', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
      });
      const result = await service.getMe('user-1');
      expect(result).toEqual({
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        isAdmin: true,
      });
    });
  });
});
