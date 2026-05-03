import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Staff } from './staff.entity';
import { User } from '../user/user.entity';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [TypeOrmModule.forFeature([Staff, User])],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
