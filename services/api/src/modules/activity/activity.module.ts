import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from './activity.entity';
import { Staff } from '../staff/staff.entity';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, Staff])],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
