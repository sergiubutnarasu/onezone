import { describe, it, expect, vi } from 'vitest';
import { RedisHealthIndicator } from './redis.indicator.js';
import { HealthCheckError } from '@nestjs/terminus';
import { createClient } from 'redis';

vi.mock('redis', () => ({
  createClient: vi.fn(),
}));

const createMockClient = (pingResult: string | 'throw' = 'PONG', quitThrows = false) => {
  const client = {
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi
      .fn()
      .mockImplementation(() =>
        pingResult === 'throw' ? Promise.reject(new Error('Redis down')) : Promise.resolve(pingResult),
      ),
    quit: vi.fn().mockImplementation(() =>
      quitThrows ? Promise.reject(new Error('Quit failed')) : Promise.resolve(undefined),
    ),
  };
  vi.mocked(createClient).mockReturnValue(client as any);
  return client;
};

describe('RedisHealthIndicator', () => {
  it('returns healthy when ping returns PONG', async () => {
    createMockClient('PONG');
    const indicator = new RedisHealthIndicator();
    const result = await indicator.pingCheck('redis');
    expect(result).toEqual({ redis: { status: 'up' } });
  });

  it('returns unhealthy when ping does not return PONG', async () => {
    createMockClient('NOT_PONG');
    const indicator = new RedisHealthIndicator();
    const result = await indicator.pingCheck('redis');
    expect(result).toEqual({ redis: { status: 'down' } });
  });

  it('throws HealthCheckError when connection fails', async () => {
    createMockClient('throw');
    const indicator = new RedisHealthIndicator();
    await expect(indicator.pingCheck('redis')).rejects.toThrow(HealthCheckError);
  });

  it('throws HealthCheckError when quit also fails', async () => {
    createMockClient('throw', true);
    const indicator = new RedisHealthIndicator();
    await expect(indicator.pingCheck('redis')).rejects.toThrow(HealthCheckError);
  });
});
