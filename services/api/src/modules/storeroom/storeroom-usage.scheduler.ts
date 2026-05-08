import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StoreroomService } from './storeroom.service';

@Injectable()
export class StoreroomUsageScheduler {
  private readonly logger = new Logger(StoreroomUsageScheduler.name);

  constructor(private readonly storeroomService: StoreroomService) {}

  @Cron('0 0 2 * * 6', {
    name: 'storeroom-weekly-average-usage',
    timeZone: 'America/Sao_Paulo',
  })
  async consolidateWeeklyAverageUsage() {
    this.logger.log('Starting storeroom weekly average usage consolidation');

    try {
      const result = await this.storeroomService.consolidateWeeklyAverageUsage();

      if (result.skipped) {
        this.logger.log('Storeroom weekly average usage consolidation skipped because another instance is running');
        return;
      }

      this.logger.log(
        `Finished storeroom weekly average usage consolidation: ${result.updatedItems} items updated for ${result.windowStart} to ${result.windowEnd}`,
      );
    } catch (error) {
      this.logger.error('Failed to consolidate storeroom weekly average usage', error instanceof Error ? error.stack : error);
      throw error;
    }
  }
}
