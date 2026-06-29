import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '../auth/public.decorator';
import { PrismaHealthIndicator } from './prisma.indicator';
import { RedisHealthIndicator } from './redis.indicator';
import { S3HealthIndicator } from './s3.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly s3: S3HealthIndicator,
  ) {}

  /** Liveness — is the process alive? */
  @Get('live')
  @Public()
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  /** Readiness — are all dependencies reachable? */
  @Get('ready')
  @Public()
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prisma.pingCheck('prisma'),
      () => this.redis.pingCheck('redis'),
      () => this.s3.pingCheck('s3'),
    ]);
  }
}