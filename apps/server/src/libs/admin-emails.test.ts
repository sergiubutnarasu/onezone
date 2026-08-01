import { describe, it, expect, vi } from 'vitest';
import { getAdminEmails, isAdminEmail } from './admin-emails.js';
import type { ConfigService } from '@nestjs/config';

const createMockConfig = (value: string | undefined): ConfigService =>
  ({
    get: (_key: string, defaultValue?: string) => value ?? defaultValue ?? '',
  }) as ConfigService;

describe('getAdminEmails', () => {
  it('returns empty array when ADMIN_EMAILS is empty', () => {
    const config = createMockConfig('');
    expect(getAdminEmails(config)).toEqual([]);
  });

  it('splits comma-separated emails', () => {
    const config = createMockConfig('admin@example.com, owner@example.com');
    expect(getAdminEmails(config)).toEqual(['admin@example.com', 'owner@example.com']);
  });

  it('trims whitespace and lowercases emails', () => {
    const config = createMockConfig('  Admin@Example.COM  ,  OWNER@EXAMPLE.COM  ');
    expect(getAdminEmails(config)).toEqual(['admin@example.com', 'owner@example.com']);
  });

  it('filters empty entries', () => {
    const config = createMockConfig('admin@example.com,,owner@example.com');
    expect(getAdminEmails(config)).toEqual(['admin@example.com', 'owner@example.com']);
  });
});

describe('isAdminEmail', () => {
  it('returns true for exact match', () => {
    const config = createMockConfig('admin@example.com');
    expect(isAdminEmail(config, 'admin@example.com')).toBe(true);
  });

  it('returns true for case-insensitive match', () => {
    const config = createMockConfig('ADMIN@EXAMPLE.COM');
    expect(isAdminEmail(config, 'admin@example.com')).toBe(true);
  });

  it('returns false for non-admin email', () => {
    const config = createMockConfig('admin@example.com');
    expect(isAdminEmail(config, 'user@example.com')).toBe(false);
  });

  it('returns false when admin list is empty', () => {
    const config = createMockConfig('');
    expect(isAdminEmail(config, 'admin@example.com')).toBe(false);
  });
});
