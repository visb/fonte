import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class UpdateMinistryDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsOptional()
  leaderId?: string | null;

  // Story 205: filho volta a poder liderar (`'RESIDENT'`), desde que esteja em
  // acolhimento na casa do ministério — o service valida e devolve 400.
  @IsIn(['STAFF', 'RESIDENT'])
  @IsOptional()
  leaderType?: 'STAFF' | 'RESIDENT' | null;
}
