import { Module } from '@nestjs/common';
import { DataRightsModule } from '../data-rights/data-rights.module';
import { RetentionService } from './retention.service';
import { RetentionController } from './retention.controller';

@Module({
  imports: [DataRightsModule],
  controllers: [RetentionController],
  providers: [RetentionService],
})
export class RetentionModule {}
