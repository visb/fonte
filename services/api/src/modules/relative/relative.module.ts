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

@Module({
  imports: [TypeOrmModule.forFeature([Relative, Resident, Staff, User]), StorageModule, ResidentFollowUpModule],
  controllers: [RelativeController],
  providers: [RelativeService],
  exports: [RelativeService],
})
export class RelativeModule {}
