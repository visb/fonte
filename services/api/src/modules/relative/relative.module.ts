import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Relative } from './relative.entity';
import { RelativeController } from './relative.controller';
import { RelativeService } from './relative.service';
import { Resident } from '../resident/resident.entity';
import { Staff } from '../staff/staff.entity';
import { User } from '../user/user.entity';
import { StorageModule } from '../storage/storage.module';
import { ResidentFollowUpModule } from '../resident-follow-up/resident-follow-up.module';
// Story 193 — a lista de parcelas pagas do familiar vem do dono da tabela, e o
// recibo, do ReceiptService: o módulo do familiar não consulta carnê por conta
// própria nem sabe renderizar PDF.
import { ResidentReceivableModule } from '../resident-receivable/resident-receivable.module';
import { ReceiptModule } from '../receipt/receipt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Relative, Resident, Staff, User]),
    StorageModule,
    ResidentFollowUpModule,
    ResidentReceivableModule,
    ReceiptModule,
  ],
  controllers: [RelativeController],
  providers: [RelativeService],
  exports: [RelativeService],
})
export class RelativeModule {}
