import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Associate } from './associate.entity';
import { AssociateSubscription } from './associate-subscription.entity';
import { AssociateCharge } from './associate-charge.entity';
import { AssociateChargeNotification } from './associate-charge-notification.entity';
import { EventRegistration } from '../event/event-registration.entity';
import { AssociateController } from './associate.controller';
import { AssociateService } from './associate.service';
import { PublicAssociateController } from './public-associate.controller';
import { AssociatePaymentService } from './associate-payment.service';
import { PAYMENT_GATEWAY } from './gateway/gateway.types';
import { HttpPagarmeGateway } from './gateway/pagarme.gateway';
import { PagarmeWebhookController } from './gateway/pagarme-webhook.controller';
import { PagarmeWebhookService } from './gateway/pagarme-webhook.service';
import { AssociateChargeScheduler } from './associate-charge.scheduler';
import { WHATSAPP_CLIENT } from './whatsapp/whatsapp.types';
import { MetaWhatsAppClient } from './whatsapp/whatsapp.client';
import { AssociateChargeController } from './associate-charge.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Associate,
      AssociateSubscription,
      AssociateCharge,
      AssociateChargeNotification,
      // Webhook Pagar.me roteia charges avulsas de evento (story 69) → precisa do repo.
      EventRegistration,
    ]),
  ],
  controllers: [
    AssociateController,
    AssociateChargeController,
    PublicAssociateController,
    PagarmeWebhookController,
  ],
  providers: [
    AssociateService,
    AssociatePaymentService,
    PagarmeWebhookService,
    AssociateChargeScheduler,
    { provide: PAYMENT_GATEWAY, useClass: HttpPagarmeGateway },
    { provide: WHATSAPP_CLIENT, useClass: MetaWhatsAppClient },
  ],
  // PAYMENT_GATEWAY exportado p/ o EventModule reusar a mesma impl (story 69).
  // WHATSAPP_CLIENT exportado p/ o EventModule enviar o link de pagamento de
  // evento pelo mesmo cliente Meta (story 70).
  exports: [AssociateService, PAYMENT_GATEWAY, WHATSAPP_CLIENT],
})
export class AssociateModule {}
