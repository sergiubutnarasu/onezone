import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { createClient } from 'redis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = createClient({ url });

    try {
      await client.connect();
      const pong = await client.ping();
      await client.quit();
      return this.getStatus(key, pong === 'PONG');
    } catch (err) {
      try {
        await client.quit();
      } catch {
        /* ignore */
      }
      throw new HealthCheckError('Redis check failed', {
        [key]: { status: 'down', message: (err as Error).message },
      });
    }
  }
}