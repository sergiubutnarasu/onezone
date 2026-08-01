import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { IS_PUBLIC_KEY, Public } from './public.decorator.js';
import { Reflector } from '@nestjs/core';

describe('Public decorator', () => {
  it('sets metadata key IS_PUBLIC_KEY to true', () => {
    const decorator = Public();
    const target = {};
    const propertyKey = 'testMethod';
    const descriptor = { value: () => {} };
    decorator(target, propertyKey, descriptor as PropertyDescriptor);

    // SetMetadata stores metadata on descriptor.value, not on target[propertyKey]
    const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, descriptor.value);
    expect(metadata).toBe(true);
  });
});
