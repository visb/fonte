import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Staff } from './staff.entity';
import { StaffPermission } from './staff-permission.entity';
import { StaffAttachment } from './staff-attachment.entity';
import { User } from '../user/user.entity';
import { SupportGroup } from '../support-group/support-group.entity';
import { StorageModule } from '../storage/storage.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffAttachmentService } from './staff-attachment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Staff, StaffPermission, StaffAttachment, User, SupportGroup]),
    StorageModule,
  ],
  controllers: [StaffController],
  providers: [StaffService, StaffAttachmentService],
  exports: [StaffService],
})
export class StaffModule {}
