import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getJwtConfig } from '../../config/jwt.config';
import { Notification } from './notification.entity';
import { NotificationRead } from './notification-read.entity';
import { Staff } from '../staff/staff.entity';
import { ResidentReceivable } from '../resident-receivable/resident-receivable.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationScheduler } from './notification.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationRead,
      Staff,
      ResidentReceivable,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: getJwtConfig,
    }),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationGateway, NotificationScheduler],
  exports: [NotificationService],
})
export class NotificationModule {}
