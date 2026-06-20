import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './event.entity';
import { EventRegistration } from './event-registration.entity';
import { EventController } from './event.controller';
import { PublicEventController } from './public-event.controller';
import { PublicEventPaymentController } from './public-event-payment.controller';
import { EventService } from './event.service';
import { EventRegistrationService } from './event-registration.service';
import { EventPaymentService } from './event-payment.service';
import { AssociateModule } from '../associate/associate.module';

@Module({
  // AssociateModule exporta PAYMENT_GATEWAY (story 41) — reusado p/ cobrança
  // avulsa da inscrição (story 69).
  imports: [TypeOrmModule.forFeature([Event, EventRegistration]), AssociateModule],
  controllers: [EventController, PublicEventController, PublicEventPaymentController],
  providers: [EventService, EventRegistrationService, EventPaymentService],
})
export class EventModule {}
