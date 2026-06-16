import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Associate } from './associate.entity';
import { AssociateSubscription } from './associate-subscription.entity';
import { AssociateCharge } from './associate-charge.entity';
import { AssociateChargeNotification } from './associate-charge-notification.entity';
import { AssociateController } from './associate.controller';
import { AssociateService } from './associate.service';
import { PublicAssociateController } from './public-associate.controller';
import { AssociatePaymentService } from './associate-payment.service';
import { ABACATEPAY_CLIENT } from './abacatepay/abacatepay.types';
import { HttpAbacatePayClient } from './abacatepay/abacatepay.client';
import { AbacatePayWebhookController } from './abacatepay/abacatepay-webhook.controller';
import { AbacatePayWebhookService } from './abacatepay/abacatepay-webhook.service';
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
    ]),
  ],
  controllers: [
    AssociateController,
    AssociateChargeController,
    PublicAssociateController,
    AbacatePayWebhookController,
  ],
  providers: [
    AssociateService,
    AssociatePaymentService,
    AbacatePayWebhookService,
    AssociateChargeScheduler,
    { provide: ABACATEPAY_CLIENT, useClass: HttpAbacatePayClient },
    { provide: WHATSAPP_CLIENT, useClass: MetaWhatsAppClient },
  ],
  exports: [AssociateService],
})
export class AssociateModule {}
