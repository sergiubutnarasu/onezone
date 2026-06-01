import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AdminGuard } from '../auth/admin.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AgentsController],
  providers: [AgentsService, AdminGuard],
  exports: [AgentsService],
})
export class AgentsModule {}
