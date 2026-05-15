import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimerResetFrequency } from '@fonte/types';
import { AppSettings } from './app-settings.entity';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';

@Injectable()
export class AppSettingsService {
  constructor(
    @InjectRepository(AppSettings)
    private repo: Repository<AppSettings>,
  ) {}

  async get(): Promise<AppSettings> {
    let settings = await this.repo.findOne({ where: {} });
    if (!settings) {
      settings = await this.repo.save(
        this.repo.create({
          timerResetFrequency: TimerResetFrequency.DAILY,
          dailyUsageMinutes: 20,
        }),
      );
    }
    return settings;
  }

  async update(dto: UpdateAppSettingsDto): Promise<AppSettings> {
    const settings = await this.get();
    if (dto.timerResetFrequency !== undefined) settings.timerResetFrequency = dto.timerResetFrequency;
    if (dto.dailyUsageMinutes !== undefined) settings.dailyUsageMinutes = dto.dailyUsageMinutes;
    return this.repo.save(settings);
  }

  async getDailyLimitSeconds(): Promise<number> {
    const settings = await this.get();
    return settings.dailyUsageMinutes * 60;
  }
}
