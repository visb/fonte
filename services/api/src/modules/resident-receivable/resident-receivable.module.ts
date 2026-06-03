import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResidentReceivable } from './resident-receivable.entity';
import { ResidentReceivableService } from './resident-receivable.service';
import { Resident } from '../resident/resident.entity';
import { Staff } from '../staff/staff.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ResidentReceivable, Resident, Staff])],
  providers: [ResidentReceivableService],
  exports: [ResidentReceivableService],
})
export class ResidentReceivableModule {}
