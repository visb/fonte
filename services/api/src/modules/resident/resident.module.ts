import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resident } from './resident.entity';
import { ResidentController } from './resident.controller';
import { ResidentService } from './resident.service';

@Module({
  imports: [TypeOrmModule.forFeature([Resident])],
  controllers: [ResidentController],
  providers: [ResidentService],
  exports: [ResidentService],
})
export class ResidentModule {}
