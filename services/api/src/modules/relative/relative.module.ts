import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Relative } from './relative.entity';
import { RelativeController } from './relative.controller';
import { RelativeService } from './relative.service';
import { Resident } from '../resident/resident.entity';
import { User } from '../user/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Relative, Resident, User])],
  controllers: [RelativeController],
  providers: [RelativeService],
  exports: [RelativeService],
})
export class RelativeModule {}
