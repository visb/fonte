import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreetSale } from './street-sale.entity';
import { StreetSaleController } from './street-sale.controller';
import { StreetSaleService } from './street-sale.service';
import { Staff } from '../staff/staff.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StreetSale, Staff])],
  controllers: [StreetSaleController],
  providers: [StreetSaleService],
})
export class StreetSaleModule {}
