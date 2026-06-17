import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './event.entity';
import { EventRegistration } from './event-registration.entity';
import { EventController } from './event.controller';
import { PublicEventController } from './public-event.controller';
import { EventService } from './event.service';
import { EventRegistrationService } from './event-registration.service';

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventRegistration])],
  controllers: [EventController, PublicEventController],
  providers: [EventService, EventRegistrationService],
})
export class EventModule {}
