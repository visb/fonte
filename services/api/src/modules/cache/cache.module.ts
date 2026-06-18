import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Cache global de aplicação (Redis). Global para que qualquer módulo possa
 * injetar o CacheService sem reimportar o módulo.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
