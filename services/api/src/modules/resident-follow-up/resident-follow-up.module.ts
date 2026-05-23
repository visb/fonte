import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResidentFollowUp } from './resident-follow-up.entity';
import { ResidentFollowUpService } from './resident-follow-up.service';
import { Staff } from '../staff/staff.entity';
import { Resident } from '../resident/resident.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ResidentFollowUp, Staff, Resident])],
  providers: [ResidentFollowUpService],
  exports: [ResidentFollowUpService],
})
export class ResidentFollowUpModule {}
