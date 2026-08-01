import { describe, it, expect } from 'vitest';
import { parseWebOrigins, getWebOrigins, isAllowedOrigin, usesHttps } from './web-origins.js';
import type { ConfigService } from '@nestjs/config';

const createMockConfig = (value: string | undefined): ConfigService =>
  ({
    getOrThrow: (_key: string) => value,
    get: (_key: string, defaultValue?: string) => value ?? defaultValue,
  }) as ConfigService;

describe('parseWebOrigins', () => {
  it('returns empty array for undefined', () => {
    expect(parseWebOrigins(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseWebOrigins('')).toEqual([]);
  });

  it('splits comma-separated origins', () => {
    const raw = 'http://localhost:3000,http://localhost:3001';
    expect(parseWebOrigins(raw)).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  it('trims whitespace around origins', () => {
    const raw = ' http://a.com , http://b.com ';
    expect(parseWebOrigins(raw)).toEqual(['http://a.com', 'http://b.com']);
  });

  it('removes empty entries', () => {
    const raw = 'http://a.com,,http://b.com';
    expect(parseWebOrigins(raw)).toEqual(['http://a.com', 'http://b.com']);
  });

  it('deduplicates origins', () => {
    const raw = 'http://a.com,http://a.com';
    expect(parseWebOrigins(raw)).toEqual(['http://a.com']);
  });
});

describe('getWebOrigins', () => {
  it('reads WEB_ORIGINS from config', () => {
    const config = createMockConfig('http://localhost:3000');
    expect(getWebOrigins(config)).toEqual(['http://localhost:3000']);
  });

  it('handles multiple origins from config', () => {
    const config = createMockConfig('http://a.com,http://b.com');
    expect(getWebOrigins(config)).toEqual(['http://a.com', 'http://b.com']);
  });
});

describe('isAllowedOrigin', () => {
  it('returns false for undefined origin', () => {
    const config = createMockConfig('http://localhost:3000');
    expect(isAllowedOrigin(undefined, config)).toBe(false);
  });

  it('returns true for allowed origin', () => {
    const config = createMockConfig('http://localhost:3000,http://localhost:3001');
    expect(isAllowedOrigin('http://localhost:3000', config)).toBe(true);
  });

  it('returns false for disallowed origin', () => {
    const config = createMockConfig('http://localhost:3000');
    expect(isAllowedOrigin('http://evil.com', config)).toBe(false);
  });
});

describe('usesHttps', () => {
  it('returns true when at least one origin uses HTTPS', () => {
    const config = createMockConfig('https://a.com,http://b.com');
    expect(usesHttps(config)).toBe(true);
  });

  it('returns false when no origin uses HTTPS', () => {
    const config = createMockConfig('http://a.com,http://b.com');
    expect(usesHttps(config)).toBe(false);
  });

  it('returns false for empty origins', () => {
    const config = createMockConfig('');
    expect(usesHttps(config)).toBe(false);
  });
});
