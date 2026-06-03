import { Module } from '@nestjs/common';
import { MemoryController } from './memory.controller';
import { S3Module } from '../s3/s3.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [S3Module, ProjectsModule],
  controllers: [MemoryController],
})
export class MemoryModule {}
