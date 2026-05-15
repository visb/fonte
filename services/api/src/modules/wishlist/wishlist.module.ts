import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resident } from '../resident/resident.entity';
import { Relative } from '../relative/relative.entity';
import { Staff } from '../staff/staff.entity';
import { StaffPermission } from '../staff/staff-permission.entity';
import { WishlistItem } from './wishlist-item.entity';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [TypeOrmModule.forFeature([WishlistItem, Resident, Relative, Staff, StaffPermission])],
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
