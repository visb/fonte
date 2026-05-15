import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resident } from '../resident/resident.entity';
import { Relative } from '../relative/relative.entity';
import { Staff } from '../staff/staff.entity';
import { User } from '../user/user.entity';
import { SupportGroup } from '../support-group/support-group.entity';
import { SupportGroupMeeting } from '../support-group/support-group-meeting.entity';
import { SupportGroupRelativeCheckin } from '../support-group/support-group-relative-checkin.entity';
import { StaffPermission } from '../staff/staff-permission.entity';
import { Message } from './message.entity';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';

@Module({
  imports: [TypeOrmModule.forFeature([Message, Resident, Relative, Staff, StaffPermission, User, SupportGroup, SupportGroupMeeting, SupportGroupRelativeCheckin])],
  controllers: [MessageController],
  providers: [MessageService],
})
export class MessageModule {}
