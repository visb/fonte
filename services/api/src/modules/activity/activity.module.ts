import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from './activity.entity';
import { ActivityComment } from './activity-comment.entity';
import { Staff } from '../staff/staff.entity';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { ActivityCommentController } from './activity-comment.controller';
import { ActivityCommentService } from './activity-comment.service';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, ActivityComment, Staff])],
  controllers: [ActivityController, ActivityCommentController],
  providers: [ActivityService, ActivityCommentService],
})
export class ActivityModule {}
