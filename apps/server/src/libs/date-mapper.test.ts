import { describe, it, expect } from 'vitest';
import { toISO, toISONow } from './date-mapper.js';

describe('toISO', () => {
  it('returns null for null', () => {
    expect(toISO(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(toISO(undefined)).toBeNull();
  });

  it('returns the same string for string input', () => {
    expect(toISO('2024-01-01T00:00:00.000Z')).toBe('2024-01-01T00:00:00.000Z');
  });

  it('converts a Date to ISO string', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    expect(toISO(date)).toBe('2024-01-01T00:00:00.000Z');
  });
});

describe('toISONow', () => {
  it('returns now-ish timestamp for null', () => {
    const result = toISONow(null);
    const now = new Date().toISOString();
    // Result should be very close to current time
    expect(Math.abs(new Date(result).getTime() - new Date(now).getTime())).toBeLessThan(5000);
  });

  it('returns now-ish timestamp for undefined', () => {
    const result = toISONow(undefined);
    const now = new Date().toISOString();
    expect(Math.abs(new Date(result).getTime() - new Date(now).getTime())).toBeLessThan(5000);
  });

  it('returns string input unchanged', () => {
    expect(toISONow('2024-01-01T00:00:00.000Z')).toBe('2024-01-01T00:00:00.000Z');
  });

  it('converts a Date to ISO string', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    expect(toISONow(date)).toBe('2024-01-01T00:00:00.000Z');
  });
});
