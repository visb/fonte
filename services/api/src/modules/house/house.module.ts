import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { House } from './house.entity';
import { HousePhoto } from './house-photo.entity';
import { HouseRule } from './house-rule.entity';
import { HouseController } from './house.controller';
import { HouseService } from './house.service';
import { MinistryModule } from '../ministry/ministry.module';

@Module({
  imports: [TypeOrmModule.forFeature([House, HousePhoto, HouseRule]), MinistryModule],
  controllers: [HouseController],
  providers: [HouseService],
  exports: [HouseService],
})
export class HouseModule {}
