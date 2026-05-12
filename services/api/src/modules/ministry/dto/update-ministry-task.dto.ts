import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { TaskRepetition } from '../ministry-task.entity';

export class UpdateMinistryTaskDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;

  @IsIn(['NONE', 'DAILY'])
  @IsOptional()
  repetition?: TaskRepetition;
}
