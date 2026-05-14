import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Relative } from './relative.entity';
import { RelativeController } from './relative.controller';
import { RelativeService } from './relative.service';
import { Resident } from '../resident/resident.entity';
import { User } from '../user/user.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Relative, Resident, User]), StorageModule],
  controllers: [RelativeController],
  providers: [RelativeService],
  exports: [RelativeService],
})
export class RelativeModule {}
