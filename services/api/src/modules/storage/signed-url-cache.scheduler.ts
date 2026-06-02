import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StorageService } from './storage.service';

@Injectable()
export class SignedUrlCacheScheduler {
  private readonly logger = new Logger(SignedUrlCacheScheduler.name);

  constructor(private readonly storage: StorageService) {}

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'signed-url-cache-sweep' })
  sweep() {
    const removed = this.storage.sweepExpiredUrls();
    if (removed > 0) {
      this.logger.debug(`Swept ${removed} expired signed URL cache entries`);
    }
  }
}
