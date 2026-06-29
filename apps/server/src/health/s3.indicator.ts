import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { S3Service } from '../s3/s3.service';

@Injectable()
export class S3HealthIndicator extends HealthIndicator {
  constructor(private readonly s3: S3Service) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.s3.ping();
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError('S3 check failed', {
        [key]: { status: 'down', message: (err as Error).message },
      });
    }
  }
}