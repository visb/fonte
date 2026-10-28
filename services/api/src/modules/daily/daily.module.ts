import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getJwtConfig } from '../../config/jwt.config';
import { MinistryModule } from '../ministry/ministry.module';
import { DailySession } from './daily-session.entity';
import { DailySessionAssignment } from './daily-session-assignment.entity';
import { DailyRepository } from './daily.repository';
import { DailyService } from './daily.service';
import { DailyController } from './daily.controller';
import { DailyGateway } from './daily.gateway';

/** Story 225 — módulo Daily (board de ministérios em tempo real). */
@Module({
  imports: [
    TypeOrmModule.forFeature([DailySession, DailySessionAssignment]),
    MinistryModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: getJwtConfig,
    }),
  ],
  controllers: [DailyController],
  providers: [DailyRepository, DailyService, DailyGateway],
})
export class DailyModule {}
