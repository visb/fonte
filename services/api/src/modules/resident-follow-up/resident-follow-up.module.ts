import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResidentFollowUp } from './resident-follow-up.entity';
import { ResidentFollowUpService } from './resident-follow-up.service';
import { Staff } from '../staff/staff.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ResidentFollowUp, Staff])],
  providers: [ResidentFollowUpService],
  exports: [ResidentFollowUpService],
})
export class ResidentFollowUpModule {}
