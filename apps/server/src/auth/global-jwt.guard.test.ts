import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { GlobalJwtGuard } from './global-jwt.guard.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

vi.mock('@nestjs/passport', () => ({
  AuthGuard: vi.fn().mockImplementation(() =>
    class MockAuthGuard {
      canActivate(_context: ExecutionContext) {
        return true;
      }
    }
  ),
}));

describe('GlobalJwtGuard', () => {
  let guard: GlobalJwtGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new GlobalJwtGuard(reflector);
  });

  it('allows access to public routes', () => {
    const handler = () => {};
    const targetClass = class TestClass {};

    Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);

    const context = {
      getHandler: () => handler,
      getClass: () => targetClass,
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('delegates to parent canActivate for non-public routes', () => {
    const handler = () => {};
    const targetClass = class TestClass {};

    const context = {
      getHandler: () => handler,
      getClass: () => targetClass,
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });
});
