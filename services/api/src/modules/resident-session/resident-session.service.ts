import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResidentUsageSession } from './resident-usage-session.entity';
import { Resident } from '../resident/resident.entity';
import { AppSettingsService } from '../app-settings/app-settings.service';

@Injectable()
export class ResidentSessionService {
  constructor(
    @InjectRepository(ResidentUsageSession)
    private sessionRepository: Repository<ResidentUsageSession>,
    @InjectRepository(Resident)
    private residentRepository: Repository<Resident>,
    private appSettingsService: AppSettingsService,
  ) {}

  private today(): string {
    return new Date().toISOString().split('T')[0];
  }

  async getToday(residentId: string): Promise<{ secondsUsed: number; limitSeconds: number }> {
    const limitSeconds = await this.appSettingsService.getDailyLimitSeconds();
    const session = await this.sessionRepository.findOne({
      where: { residentId, date: this.today() },
    });
    return { secondsUsed: session?.secondsUsed ?? 0, limitSeconds };
  }

  async getTodayByUserId(userId: string): Promise<{ secondsUsed: number; limitSeconds: number }> {
    const resident = await this.residentRepository.findOne({ where: { userId } });
    if (!resident) throw new NotFoundException('Perfil de interno não encontrado');
    return this.getToday(resident.id);
  }

  async addSeconds(
    userId: string,
    seconds: number,
  ): Promise<{ secondsUsed: number; limitSeconds: number }> {
    const resident = await this.residentRepository.findOne({ where: { userId } });
    if (!resident) throw new NotFoundException('Perfil de interno não encontrado');

    const limitSeconds = await this.appSettingsService.getDailyLimitSeconds();
    const date = this.today();
    const clamped = Math.min(Math.max(0, seconds), limitSeconds);

    // Atomic upsert: safe for concurrent requests from multiple devices.
    const result = await this.sessionRepository.query(
      `INSERT INTO resident_usage_sessions (resident_id, date, seconds_used, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (resident_id, date)
       DO UPDATE SET
         seconds_used = LEAST(resident_usage_sessions.seconds_used + EXCLUDED.seconds_used, $4),
         updated_at = now()
       RETURNING seconds_used`,
      [resident.id, date, clamped, limitSeconds],
    );

    return { secondsUsed: result[0].seconds_used, limitSeconds };
  }

  async reset(residentId: string): Promise<void> {
    const date = this.today();
    const session = await this.sessionRepository.findOne({
      where: { residentId, date },
    });
    if (session) {
      await this.sessionRepository.update(session.id, { secondsUsed: 0 });
    }
  }
}
