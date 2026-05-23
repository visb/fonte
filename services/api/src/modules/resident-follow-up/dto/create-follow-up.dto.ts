import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { FollowUpAccessLevel, FollowUpType } from '@fonte/types';

export class CreateFollowUpDto {
  @IsDateString()
  date: string;

  @IsEnum(FollowUpType)
  type: FollowUpType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(FollowUpAccessLevel)
  accessLevel: FollowUpAccessLevel;
}
