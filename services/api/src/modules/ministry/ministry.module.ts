import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ministry } from './ministry.entity';
import { MinistryStaff } from './ministry-staff.entity';
import { MinistryTask } from './ministry-task.entity';
import { MinistryController } from './ministry.controller';
import { MinistryService } from './ministry.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ministry, MinistryStaff, MinistryTask])],
  controllers: [MinistryController],
  providers: [MinistryService],
  exports: [MinistryService],
})
export class MinistryModule {}
