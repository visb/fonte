import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from './incident.entity';
import { IncidentController } from './incident.controller';
import { IncidentService } from './incident.service';
import { NotificationModule } from '../notification/notification.module';
import { Resident } from '../resident/resident.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Incident, Resident]), NotificationModule],
  controllers: [IncidentController],
  providers: [IncidentService],
})
export class IncidentModule {}
