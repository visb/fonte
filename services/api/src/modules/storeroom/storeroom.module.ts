import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreroomItem } from './storeroom.entity';
import { StoreroomMovement } from './storeroom-movement.entity';
import { StoreroomController } from './storeroom.controller';
import { StoreroomService } from './storeroom.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoreroomItem, StoreroomMovement])],
  controllers: [StoreroomController],
  providers: [StoreroomService],
})
export class StoreroomModule {}
