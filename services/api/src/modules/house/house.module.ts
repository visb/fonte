import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { House } from './house.entity';
import { HouseController } from './house.controller';
import { HouseService } from './house.service';

@Module({
  imports: [TypeOrmModule.forFeature([House])],
  controllers: [HouseController],
  providers: [HouseService],
  exports: [HouseService],
})
export class HouseModule {}
