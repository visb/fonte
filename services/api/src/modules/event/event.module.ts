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
import { EventPaymentNotifierService } from './event-payment-notifier.service';
import { AssociateModule } from '../associate/associate.module';
import { MailModule } from '../mail/mail.module';

@Module({
  // AssociateModule exporta PAYMENT_GATEWAY (story 41) e WHATSAPP_CLIENT (story 70).
  // MailModule exporta MAIL_SENDER (story 70) p/ enviar o link de pagamento.
  imports: [
    TypeOrmModule.forFeature([Event, EventRegistration]),
    AssociateModule,
    MailModule,
  ],
  controllers: [EventController, PublicEventController, PublicEventPaymentController],
  providers: [
    EventService,
    EventRegistrationService,
    EventPaymentService,
    EventPaymentNotifierService,
  ],
})
export class EventModule {}
