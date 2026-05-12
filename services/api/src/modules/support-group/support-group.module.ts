import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportGroup } from './support-group.entity';
import { SupportGroupMeeting } from './support-group-meeting.entity';
import { SupportGroupCheckin } from './support-group-checkin.entity';
import { SupportGroupController } from './support-group.controller';
import { SupportGroupService } from './support-group.service';

@Module({
  imports: [TypeOrmModule.forFeature([SupportGroup, SupportGroupMeeting, SupportGroupCheckin])],
  controllers: [SupportGroupController],
  providers: [SupportGroupService],
  exports: [SupportGroupService],
})
export class SupportGroupModule {}
