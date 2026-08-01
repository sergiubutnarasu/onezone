import { describe, it, expect, vi } from 'vitest';
import { S3HealthIndicator } from './s3.indicator.js';
import type { S3Service } from '../s3/s3.service.js';
import { HealthCheckError } from '@nestjs/terminus';

const createMockS3 = (pingResult: Promise<void> | 'throw' = Promise.resolve()) =>
  ({
    ping: vi.fn().mockImplementation(() =>
      pingResult === 'throw' ? Promise.reject(new Error('S3 down')) : pingResult,
    ),
  } as unknown as S3Service);

describe('S3HealthIndicator', () => {
  it('returns healthy when ping succeeds', async () => {
    const s3 = createMockS3();
    const indicator = new S3HealthIndicator(s3);
    const result = await indicator.pingCheck('s3');
    expect(result).toEqual({ s3: { status: 'up' } });
  });

  it('throws HealthCheckError when ping fails', async () => {
    const s3 = createMockS3('throw');
    const indicator = new S3HealthIndicator(s3);
    await expect(indicator.pingCheck('s3')).rejects.toThrow(HealthCheckError);
  });
});
