import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { StorageUrlInterceptor } from './modules/storage/storage-url.interceptor';
import { SensitiveDataInterceptor } from './common/interceptors/sensitive-data.interceptor';
import { MustChangePasswordGuard } from './common/guards/must-change-password.guard';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { HouseModule } from './modules/house/house.module';
import { StaffModule } from './modules/staff/staff.module';
import { ResidentModule } from './modules/resident/resident.module';
import { RelativeModule } from './modules/relative/relative.module';
import { IncidentModule } from './modules/incident/incident.module';
import { MinistryModule } from './modules/ministry/ministry.module';
import { StoreroomModule } from './modules/storeroom/storeroom.module';
import { DocumentTemplateModule } from './modules/document-template/document-template.module';
import { StorageModule } from './modules/storage/storage.module';
import { SupportGroupModule } from './modules/support-group/support-group.module';
import { ResidentSessionModule } from './modules/resident-session/resident-session.module';
import { MessageModule } from './modules/message/message.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { AppSettingsModule } from './modules/app-settings/app-settings.module';
import { ResidentFollowUpModule } from './modules/resident-follow-up/resident-follow-up.module';
import { StreetSaleModule } from './modules/street-sale/street-sale.module';
import { SupplyRoomModule } from './modules/supply-room/supply-room.module';
import { BibleCourseModule } from './modules/bible-course/bible-course.module';
import { NotificationModule } from './modules/notification/notification.module';
import { BackupModule } from './modules/backup/backup.module';
import { AuditModule } from './modules/audit/audit.module';
import { ConsentModule } from './modules/consent/consent.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    // LGPD art. 46 — proteção contra força bruta. Janela global padrão; o login
    // recebe limite mais estrito via @Throttle no AuthController.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuthModule,
    UserModule,
    HouseModule,
    StaffModule,
    ResidentModule,
    RelativeModule,
    IncidentModule,
    MinistryModule,
    StoreroomModule,
    DocumentTemplateModule,
    StorageModule,
    SupportGroupModule,
    ResidentSessionModule,
    MessageModule,
    WishlistModule,
    AppSettingsModule,
    ResidentFollowUpModule,
    StreetSaleModule,
    SupplyRoomModule,
    BibleCourseModule,
    NotificationModule,
    BackupModule,
    AuditModule,
    ConsentModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
    { provide: APP_INTERCEPTOR, useClass: StorageUrlInterceptor },
    // LGPD — mascaramento de CPF/RG nas respostas (minimização de dados).
    { provide: APP_INTERCEPTOR, useClass: SensitiveDataInterceptor },
  ],
})
export class AppModule {}
