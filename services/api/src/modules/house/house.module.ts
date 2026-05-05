import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { House } from './house.entity';
import { HouseMinistry } from './house-ministry.entity';
import { HousePhoto } from './house-photo.entity';
import { HouseRule } from './house-rule.entity';
import { HouseController } from './house.controller';
import { HouseService } from './house.service';

@Module({
  imports: [TypeOrmModule.forFeature([House, HousePhoto, HouseMinistry, HouseRule])],
  controllers: [HouseController],
  providers: [HouseService],
  exports: [HouseService],
})
export class HouseModule {}
