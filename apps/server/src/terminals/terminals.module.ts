import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TerminalsController } from './terminals.controller';
import { TerminalsService } from './terminals.service';
import { TerminalRegistryModule } from '../gateways/terminal-registry.module';

@Module({
  imports: [PrismaModule, TerminalRegistryModule],
  controllers: [TerminalsController],
  providers: [TerminalsService],
  exports: [TerminalsService],
})
export class TerminalsModule {}
