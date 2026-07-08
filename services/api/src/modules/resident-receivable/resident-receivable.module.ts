import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResidentReceivable } from './resident-receivable.entity';
import { ReceivableProductContribution } from './receivable-product-contribution.entity';
import { ResidentReceivableService } from './resident-receivable.service';
import { ReceivableProductContributionService } from './receivable-product-contribution.service';
import { Resident } from '../resident/resident.entity';
import { Staff } from '../staff/staff.entity';
import { InventoryItem } from '../inventory/inventory-item.entity';
import { InventoryMovement } from '../inventory/inventory-movement.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ResidentReceivable,
      ReceivableProductContribution,
      Resident,
      Staff,
      InventoryItem,
      InventoryMovement,
    ]),
    NotificationModule,
  ],
  providers: [ResidentReceivableService, ReceivableProductContributionService],
  exports: [ResidentReceivableService, ReceivableProductContributionService],
})
export class ResidentReceivableModule {}
