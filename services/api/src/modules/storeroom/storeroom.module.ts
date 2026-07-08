import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from '../inventory/inventory-item.entity';
import { InventoryMovement } from '../inventory/inventory-movement.entity';
import { StoreroomItem } from './storeroom.entity';
import { StoreroomMovement } from './storeroom-movement.entity';
import { StoreroomController } from './storeroom.controller';
import { StoreroomService } from './storeroom.service';
import { StoreroomUsageScheduler } from './storeroom-usage.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryItem, InventoryMovement, StoreroomItem, StoreroomMovement]),
  ],
  controllers: [StoreroomController],
  providers: [StoreroomService, StoreroomUsageScheduler],
})
export class StoreroomModule {}
