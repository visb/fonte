import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { House } from './house.entity';
import { HousePhoto } from './house-photo.entity';
import { HouseRule } from './house-rule.entity';
import { HouseCapacityRequest } from './house-capacity-request.entity';
import { HouseController } from './house.controller';
import { HouseCapacityRequestController } from './house-capacity-request.controller';
import { HouseService } from './house.service';
import { HouseCapacityRequestService } from './house-capacity-request.service';
import { MinistryModule } from '../ministry/ministry.module';
import { NotificationModule } from '../notification/notification.module';
import { Staff } from '../staff/staff.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([House, HousePhoto, HouseRule, HouseCapacityRequest, Staff]),
    MinistryModule,
    NotificationModule,
  ],
  controllers: [HouseController, HouseCapacityRequestController],
  providers: [HouseService, HouseCapacityRequestService],
  exports: [HouseService],
})
export class HouseModule {}
