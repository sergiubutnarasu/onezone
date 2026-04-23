import { Module } from '@nestjs/common';
import { TerminalRegistryService } from './terminal-registry.service';

@Module({
  providers: [TerminalRegistryService],
  exports: [TerminalRegistryService],
})
export class TerminalRegistryModule {}
