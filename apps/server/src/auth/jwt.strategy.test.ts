import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JwtStrategy } from './jwt.strategy.js';
import type { ConfigService } from '@nestjs/config';

const createMockConfig = (jwtSecret: string): ConfigService =>
  ({
    getOrThrow: (key: string) => {
      if (key === 'JWT_SECRET') return jwtSecret;
      throw new Error(`Missing config key: ${key}`);
    },
  }) as ConfigService;

describe('JwtStrategy', () => {
  it('throws if JWT_SECRET is missing', () => {
    const badConfig = {
      getOrThrow: () => { throw new Error('Missing'); },
    } as ConfigService;
    expect(() => new JwtStrategy(badConfig)).toThrow();
  });

  it('validates payload into user object', async () => {
    const config = createMockConfig('my-secret-key-at-least-32-characters-long');
    const strategy = new JwtStrategy(config);
    const payload = { sub: 'user-123', email: 'test@example.com' };
    const result = await strategy.validate(payload);
    expect(result).toEqual({ id: 'user-123', email: 'test@example.com' });
  });
});
