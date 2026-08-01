import { describe, it, expect, vi } from 'vitest';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator.js';

vi.mock('@nestjs/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nestjs/common')>();
  return {
    ...actual,
    createParamDecorator: vi.fn().mockImplementation((factory) => {
      const decorator = vi.fn();
      (decorator as any).KEY = factory;
      return decorator;
    }),
  };
});

describe('CurrentUser decorator', () => {
  it('is a ParamDecorator', () => {
    expect(CurrentUser).toBeDefined();
    expect(typeof CurrentUser).toBe('function');
  });

  it('extracts user from request', () => {
    // Verify by calling the internal factory function
    const factory = (CurrentUser as any).KEY;
    const user = { id: 'user-1', email: 'test@example.com' };
    const request = { user };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;

    expect(factory(undefined, context)).toEqual(user);
  });
});
