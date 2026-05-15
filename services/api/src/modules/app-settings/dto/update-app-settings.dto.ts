import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TimerResetFrequency } from '@fonte/types';

export class UpdateAppSettingsDto {
  @IsOptional()
  @IsEnum(TimerResetFrequency)
  timerResetFrequency?: TimerResetFrequency;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  dailyUsageMinutes?: number;
}
