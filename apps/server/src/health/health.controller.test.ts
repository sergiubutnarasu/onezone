import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const createMockHealthCheck = () =>
    vi.fn().mockImplementation((checks: Array<() => Promise<unknown>>) => {
      if (checks.length === 0) {
        return Promise.resolve({ status: 'ok', info: {}, error: {}, details: {} });
      }
      return Promise.resolve({
        status: 'ok',
        info: {},
        error: {},
        details: {},
      });
    });

  const createMockIndicator = (key: string) => ({
    pingCheck: vi.fn().mockResolvedValue({ [key]: { status: 'up' } }),
  });

  let controller: HealthController;
  let health: { check: ReturnType<typeof vi.fn> };
  let prisma: ReturnType<typeof createMockIndicator>;
  let redis: ReturnType<typeof createMockIndicator>;
  let s3: ReturnType<typeof createMockIndicator>;

  beforeEach(() => {
    health = { check: createMockHealthCheck() };
    prisma = createMockIndicator('prisma');
    redis = createMockIndicator('redis');
    s3 = createMockIndicator('s3');
    controller = new HealthController(health as any, prisma as any, redis as any, s3 as any);
  });

  it('liveness returns ok with no checks', async () => {
    const result = await controller.liveness();
    expect(result).toHaveProperty('status', 'ok');
    expect(health.check).toHaveBeenCalledWith([]);
  });

  it('readiness runs prisma, redis, and s3 checks', async () => {
    const result = await controller.readiness();
    expect(result).toHaveProperty('status', 'ok');
    expect(health.check).toHaveBeenCalledWith([
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    ]);
  });
});
