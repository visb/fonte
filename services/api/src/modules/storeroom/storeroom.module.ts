import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Storeroom } from './storeroom.entity';
import { StoreroomController } from './storeroom.controller';
import { StoreroomService } from './storeroom.service';

@Module({
  imports: [TypeOrmModule.forFeature([Storeroom])],
  controllers: [StoreroomController],
  providers: [StoreroomService],
})
export class StoreroomModule {}
