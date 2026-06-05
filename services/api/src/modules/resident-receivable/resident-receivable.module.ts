import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResidentReceivable } from './resident-receivable.entity';
import { ResidentReceivableService } from './resident-receivable.service';
import { Resident } from '../resident/resident.entity';
import { Staff } from '../staff/staff.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ResidentReceivable, Resident, Staff]),
    NotificationModule,
  ],
  providers: [ResidentReceivableService],
  exports: [ResidentReceivableService],
})
export class ResidentReceivableModule {}
