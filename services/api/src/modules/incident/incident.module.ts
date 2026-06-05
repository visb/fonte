import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from './incident.entity';
import { IncidentController } from './incident.controller';
import { IncidentService } from './incident.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [TypeOrmModule.forFeature([Incident]), NotificationModule],
  controllers: [IncidentController],
  providers: [IncidentService],
})
export class IncidentModule {}
