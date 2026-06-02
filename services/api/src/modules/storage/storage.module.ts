import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { SignedUrlCacheScheduler } from './signed-url-cache.scheduler';

@Global()
@Module({
  providers: [StorageService, SignedUrlCacheScheduler],
  exports: [StorageService],
})
export class StorageModule {}
