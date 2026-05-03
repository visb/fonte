import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { House } from './house.entity';
import { HousePhoto } from './house-photo.entity';
import { HouseController } from './house.controller';
import { HouseService } from './house.service';

@Module({
  imports: [TypeOrmModule.forFeature([House, HousePhoto])],
  controllers: [HouseController],
  providers: [HouseService],
  exports: [HouseService],
})
export class HouseModule {}
