import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminGuard } from './admin.guard.js';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

const createMockConfig = (value: string | undefined): ConfigService =>
  ({
    get: (_key: string, defaultValue?: string) => value ?? defaultValue ?? '',
  }) as ConfigService;

const createExecutionContext = (user?: { email: string }): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as ExecutionContext;

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    const config = createMockConfig('admin@example.com');
    guard = new AdminGuard(config);
  });

  it('allows access for admin email', () => {
    const context = createExecutionContext({ email: 'admin@example.com' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access for admin email with different case', () => {
    const context = createExecutionContext({ email: 'ADMIN@EXAMPLE.COM' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException for non-admin email', () => {
    const context = createExecutionContext({ email: 'user@example.com' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is undefined', () => {
    const context = createExecutionContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user email is missing', () => {
    const context = createExecutionContext({} as { email: string });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
