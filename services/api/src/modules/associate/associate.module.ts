import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Associate } from './associate.entity';
import { AssociateSubscription } from './associate-subscription.entity';
import { AssociateCharge } from './associate-charge.entity';
import { AssociateChargeNotification } from './associate-charge-notification.entity';
import { AssociateController } from './associate.controller';
import { AssociateService } from './associate.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Associate,
      AssociateSubscription,
      AssociateCharge,
      AssociateChargeNotification,
    ]),
  ],
  controllers: [AssociateController],
  providers: [AssociateService],
  exports: [AssociateService],
})
export class AssociateModule {}
