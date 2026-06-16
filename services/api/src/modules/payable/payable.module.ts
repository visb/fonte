import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payable } from './payable.entity';
import { PayableController } from './payable.controller';
import { PayableService } from './payable.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payable])],
  controllers: [PayableController],
  providers: [PayableService],
})
export class PayableModule {}
