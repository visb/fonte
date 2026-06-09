import { Module } from '@nestjs/common';
import { DataRightsService } from './data-rights.service';
import { DataRightsController } from './data-rights.controller';

// StorageService vem do StorageModule (@Global). DataSource é injetado via
// @InjectDataSource (TypeOrmModule raiz).
@Module({
  controllers: [DataRightsController],
  providers: [DataRightsService],
  exports: [DataRightsService],
})
export class DataRightsModule {}
