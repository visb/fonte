import { IsInt, Min, Max } from 'class-validator';

export class HeartbeatDto {
  @IsInt()
  @Min(1)
  @Max(60)
  seconds: number;
}
