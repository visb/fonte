import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from '../inventory/inventory-item.entity';
import { InventoryMovement } from '../inventory/inventory-movement.entity';
import { SupplyRoomItem } from './supply-room-item.entity';
import { SupplyRoomMovement } from './supply-room-movement.entity';
import { SupplyRoomController } from './supply-room.controller';
import { SupplyRoomService } from './supply-room.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryItem, InventoryMovement, SupplyRoomItem, SupplyRoomMovement]),
  ],
  controllers: [SupplyRoomController],
  providers: [SupplyRoomService],
})
export class SupplyRoomModule {}
