import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from './activity.entity';
import { ActivityComment } from './activity-comment.entity';
import { ActivityEvent } from './activity-event.entity';
import { ActivityAttachment } from './activity-attachment.entity';
import { Staff } from '../staff/staff.entity';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { ActivityCommentController } from './activity-comment.controller';
import { ActivityCommentService } from './activity-comment.service';
import { ActivityEventService } from './activity-event.service';
import { ActivityAttachmentController } from './activity-attachment.controller';
import { ActivityAttachmentService } from './activity-attachment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Activity,
      ActivityComment,
      ActivityEvent,
      ActivityAttachment,
      Staff,
    ]),
  ],
  controllers: [
    ActivityController,
    ActivityCommentController,
    ActivityAttachmentController,
  ],
  providers: [
    ActivityService,
    ActivityCommentService,
    ActivityEventService,
    ActivityAttachmentService,
  ],
})
export class ActivityModule {}
