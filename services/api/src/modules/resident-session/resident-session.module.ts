import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resident } from '../resident/resident.entity';
import { ResidentUsageSession } from './resident-usage-session.entity';
import { ResidentSessionController } from './resident-session.controller';
import { ResidentSessionService } from './resident-session.service';

@Module({
  imports: [TypeOrmModule.forFeature([ResidentUsageSession, Resident])],
  controllers: [ResidentSessionController],
  providers: [ResidentSessionService],
  exports: [ResidentSessionService],
})
export class ResidentSessionModule {}
