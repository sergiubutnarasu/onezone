import { Global, Module } from '@nestjs/common';
import { TerminalRegistryService } from './terminal-registry.service';

@Global()
@Module({
  providers: [TerminalRegistryService],
  exports: [TerminalRegistryService],
})
export class TerminalRegistryModule {}
