import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ministry } from './ministry.entity';
import { MinistryController } from './ministry.controller';
import { MinistryService } from './ministry.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ministry])],
  controllers: [MinistryController],
  providers: [MinistryService],
})
export class MinistryModule {}
