import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { SignedUrlCacheScheduler } from './signed-url-cache.scheduler';
import { StorageReconcileService } from './storage-reconcile.service';
import { StorageController } from './storage.controller';

@Global()
@Module({
  controllers: [StorageController],
  providers: [StorageService, SignedUrlCacheScheduler, StorageReconcileService],
  exports: [StorageService],
})
export class StorageModule {}
