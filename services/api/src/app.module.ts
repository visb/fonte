import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MustChangePasswordGuard } from './common/guards/must-change-password.guard';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { HouseModule } from './modules/house/house.module';
import { StaffModule } from './modules/staff/staff.module';
import { ResidentModule } from './modules/resident/resident.module';
import { RelativeModule } from './modules/relative/relative.module';
import { RoutineModule } from './modules/routine/routine.module';
import { IncidentModule } from './modules/incident/incident.module';
import { MinistryModule } from './modules/ministry/ministry.module';
import { StoreroomModule } from './modules/storeroom/storeroom.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    AuthModule,
    UserModule,
    HouseModule,
    StaffModule,
    ResidentModule,
    RelativeModule,
    RoutineModule,
    IncidentModule,
    MinistryModule,
    StoreroomModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
  ],
})
export class AppModule {}
