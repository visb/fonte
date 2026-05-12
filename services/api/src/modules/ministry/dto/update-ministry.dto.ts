import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class UpdateMinistryDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsOptional()
  leaderId?: string | null;

  @IsIn(['STAFF', 'RESIDENT'])
  @IsOptional()
  leaderType?: 'STAFF' | 'RESIDENT' | null;
}
