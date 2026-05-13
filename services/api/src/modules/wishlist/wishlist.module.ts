import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resident } from '../resident/resident.entity';
import { WishlistItem } from './wishlist-item.entity';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [TypeOrmModule.forFeature([WishlistItem, Resident])],
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
