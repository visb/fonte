import { Module } from '@nestjs/common';
import { ConsentModule } from '../consent/consent.module';
import { MinistryModule } from '../ministry/ministry.module';
import { ResidentModule } from '../resident/resident.module';
import { ResidentFollowUpModule } from '../resident-follow-up/resident-follow-up.module';
import { ResidentReceivableModule } from '../resident-receivable/resident-receivable.module';
import { StaffModule } from '../staff/staff.module';
import { OfflineSyncController } from './offline-sync.controller';
import { OfflineSyncService } from './offline-sync.service';

/**
 * Story 177 — agrega o pacote offline da casa consumindo os **services** dos
 * cinco módulos envolvidos. Nenhum repositório é injetado aqui: cada dado
 * continua saindo da camada de persistência do seu próprio módulo.
 */
@Module({
  imports: [
    ResidentModule,
    ResidentFollowUpModule,
    ResidentReceivableModule,
    ConsentModule,
    MinistryModule,
    StaffModule,
  ],
  controllers: [OfflineSyncController],
  providers: [OfflineSyncService],
  exports: [OfflineSyncService],
})
export class OfflineSyncModule {}
