import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma.indicator';
import { RedisHealthIndicator } from './redis.indicator';
import { S3HealthIndicator } from './s3.indicator';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [TerminusModule, S3Module],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator, S3HealthIndicator],
})
export class HealthModule {}