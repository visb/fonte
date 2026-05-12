import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { TaskRepetition } from '../ministry-task.entity';

export class CreateMinistryTaskDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsIn(['NONE', 'DAILY'])
  @IsOptional()
  repetition?: TaskRepetition;
}
