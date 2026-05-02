import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from './incident.entity';
import { IncidentController } from './incident.controller';
import { IncidentService } from './incident.service';

@Module({
  imports: [TypeOrmModule.forFeature([Incident])],
  controllers: [IncidentController],
  providers: [IncidentService],
})
export class IncidentModule {}
