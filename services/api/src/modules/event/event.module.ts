import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './event.entity';
import { EventRegistration } from './event-registration.entity';
import { Staff } from '../staff/staff.entity';
import { EventController } from './event.controller';
import { PublicEventController } from './public-event.controller';
import { PublicEventPaymentController } from './public-event-payment.controller';
import { EventService } from './event.service';
import { EventRegistrationService } from './event-registration.service';
import { EventPaymentService } from './event-payment.service';
import { EventPaymentNotifierService } from './event-payment-notifier.service';
import { EventInviteService } from './event-invite.service';
import { AssociateModule } from '../associate/associate.module';
import { MailModule } from '../mail/mail.module';

@Module({
  // AssociateModule exporta PAYMENT_GATEWAY (story 41) e WHATSAPP_CLIENT (story 70).
  // MailModule exporta MAIL_SENDER (story 70) p/ enviar o link de pagamento.
  // Staff no forFeature: o EventInviteService lê os servos selecionados para o
  // convite via WhatsApp (story 95) — só leitura, sem regra de Staff aqui.
  imports: [
    TypeOrmModule.forFeature([Event, EventRegistration, Staff]),
    AssociateModule,
    MailModule,
  ],
  controllers: [EventController, PublicEventController, PublicEventPaymentController],
  providers: [
    EventService,
    EventRegistrationService,
    EventPaymentService,
    EventPaymentNotifierService,
    EventInviteService,
  ],
})
export class EventModule {}
