import { describe, it, expect } from 'vitest';
import { EnvSchema } from './env.schema.js';

describe('EnvSchema', () => {
  const validEnv = {
    JWT_SECRET: 'a'.repeat(32),
    WEB_ORIGINS: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
    ADMIN_EMAILS: 'admin@example.com',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY_ID: 'key-id',
    S3_SECRET_ACCESS_KEY: 'secret-key',
  };

  it('accepts valid env object', () => {
    expect(() => EnvSchema.parse(validEnv)).not.toThrow();
  });

  it('parses correctly and returns the object', () => {
    const result = EnvSchema.parse(validEnv);
    expect(result.JWT_SECRET).toBe('a'.repeat(32));
    expect(result.WEB_ORIGINS).toBe('http://localhost:3000');
    expect(result.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
  });

  it('rejects JWT_SECRET shorter than 32 chars', () => {
    const invalid = { ...validEnv, JWT_SECRET: 'short' };
    expect(() => EnvSchema.parse(invalid)).toThrow(/String must contain at least 32 character/);
  });

  it('rejects missing JWT_SECRET', () => {
    const { JWT_SECRET: _, ...rest } = validEnv;
    expect(() => EnvSchema.parse(rest)).toThrow(/required/i);
  });

  it('rejects empty WEB_ORIGINS', () => {
    const invalid = { ...validEnv, WEB_ORIGINS: '' };
    expect(() => EnvSchema.parse(invalid)).toThrow(/String must contain at least 1 character/);
  });

  it('rejects invalid DATABASE_URL', () => {
    const invalid = { ...validEnv, DATABASE_URL: 'not-a-url' };
    expect(() => EnvSchema.parse(invalid)).toThrow(/url/i);
  });

  it('rejects invalid REDIS_URL', () => {
    const invalid = { ...validEnv, REDIS_URL: 'not-a-url' };
    expect(() => EnvSchema.parse(invalid)).toThrow(/url/i);
  });

  it('rejects invalid S3_ENDPOINT', () => {
    const invalid = { ...validEnv, S3_ENDPOINT: 'not-a-url' };
    expect(() => EnvSchema.parse(invalid)).toThrow(/url/i);
  });
});
